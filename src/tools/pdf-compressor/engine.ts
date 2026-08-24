import { PDFDocument } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

export type PdfCompressionLevel = 'low' | 'medium' | 'high';

export type PdfCompressionOptions = {
  level: PdfCompressionLevel;
  jpegQuality: number;
  renderScale: number;
  maxPagePixels: number;
};

export type PdfCompressionResult = {
  blob: Blob;
  inputBytes: number;
  outputBytes: number;
  savingsPercent: number;
  pageCount: number;
  usedCompression: boolean;
};

const DEFAULT_OPTIONS: PdfCompressionOptions = {
  level: 'medium',
  jpegQuality: 0.62,
  renderScale: 1.5,
  maxPagePixels: 12_000_000,
};

const LEVELS: Record<PdfCompressionLevel, Pick<PdfCompressionOptions, 'jpegQuality' | 'renderScale'>> = {
  low: { jpegQuality: 0.78, renderScale: 2 },
  medium: { jpegQuality: 0.62, renderScale: 1.5 },
  high: { jpegQuality: 0.44, renderScale: 1.05 },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getSafeScale(viewportWidth: number, viewportHeight: number, requestedScale: number, maxPagePixels: number) {
  const requestedPixels = viewportWidth * requestedScale * viewportHeight * requestedScale;
  if (requestedPixels <= maxPagePixels) return requestedScale;
  const safeScale = Math.sqrt(maxPagePixels / (viewportWidth * viewportHeight));
  return Math.max(0.35, Math.min(requestedScale, safeScale));
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('PDF page image encoding failed.'));
      else resolve(blob);
    }, 'image/jpeg', clamp(quality, 0.15, 0.92));
  });
}

async function renderPage(page: PDFPageProxy, options: PdfCompressionOptions) {
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = getSafeScale(baseViewport.width, baseViewport.height, options.renderScale, options.maxPagePixels);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas is unavailable.');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport, intent: 'print' }).promise;

  const jpeg = await canvasToJpeg(canvas, options.jpegQuality);
  return { jpeg, widthPoints: baseViewport.width, heightPoints: baseViewport.height };
}

async function buildCompressedPdf(pdf: PDFDocumentProxy, options: PdfCompressionOptions) {
  const output = await PDFDocument.create();

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const rendered = await renderPage(page, options);
    const imageBytes = await rendered.jpeg.arrayBuffer();
    const image = await output.embedJpg(imageBytes);
    const targetPage = output.addPage([rendered.widthPoints, rendered.heightPoints]);
    targetPage.drawImage(image, {
      x: 0,
      y: 0,
      width: rendered.widthPoints,
      height: rendered.heightPoints,
    });
    page.cleanup();
  }

  return output.save({ useObjectStreams: true });
}

export async function compressPdf(file: File, incomingOptions?: Partial<PdfCompressionOptions>): Promise<PdfCompressionResult> {
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please select a PDF file.');
  }
  if (file.size <= 0) throw new Error('The PDF file is empty.');
  if (file.size > 75 * 1024 * 1024) throw new Error('PDFs larger than 75 MB are not supported in the browser.');

  const level = incomingOptions?.level ?? DEFAULT_OPTIONS.level;
  const preset = LEVELS[level];
  const options: PdfCompressionOptions = {
    ...DEFAULT_OPTIONS,
    ...preset,
    ...incomingOptions,
    jpegQuality: clamp(incomingOptions?.jpegQuality ?? preset.jpegQuality, 0.15, 0.92),
    renderScale: clamp(incomingOptions?.renderScale ?? preset.renderScale, 0.35, 2.5),
    maxPagePixels: Math.max(1_000_000, Math.floor(incomingOptions?.maxPagePixels ?? DEFAULT_OPTIONS.maxPagePixels)),
  };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const safeBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(safeBuffer).set(bytes);
  const pdf = await getDocument({ data: safeBuffer }).promise;
  const outputBytes = new Uint8Array(await buildCompressedPdf(pdf, options));
  const usedCompression = outputBytes.byteLength < file.size;
  const finalBytes = usedCompression ? outputBytes : bytes;
  const outputBytesCount = finalBytes.byteLength;
  const savingsPercent = usedCompression
    ? Math.max(0, Math.round((1 - outputBytesCount / file.size) * 100))
    : 0;

  const buffer = new ArrayBuffer(finalBytes.byteLength);
  new Uint8Array(buffer).set(finalBytes);

  return {
    blob: new Blob([buffer], { type: 'application/pdf' }),
    inputBytes: file.size,
    outputBytes: outputBytesCount,
    savingsPercent,
    pageCount: pdf.numPages,
    usedCompression,
  };
}
