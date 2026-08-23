import { PDFDocument } from 'pdf-lib';

export type ImageToPdfOrientation = 'portrait' | 'landscape';
export type ImageToPdfMargin = 'none' | 'small' | 'large';

export type ImageToPdfOptions = {
  orientation: ImageToPdfOrientation;
  margin: ImageToPdfMargin;
};

const MARGINS: Record<ImageToPdfMargin, number> = { none: 0, small: 18, large: 36 };

function normalizeOrientation(imageWidth: number, imageHeight: number, orientation: ImageToPdfOrientation) {
  const imageLandscape = imageWidth > imageHeight;
  const wantsLandscape = orientation === 'landscape';
  return imageLandscape === wantsLandscape ? 'landscape' : 'portrait';
}

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function loadImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function embedImage(pdf: PDFDocument, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mime === 'image/jpeg' || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return pdf.embedJpg(arrayBufferFromBytes(bytes));
  }

  if (mime === 'image/png' || name.endsWith('.png')) {
    return pdf.embedPng(arrayBufferFromBytes(bytes));
  }

  if (mime === 'image/webp' || name.endsWith('.webp')) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = objectUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable.');
      context.drawImage(image, 0, 0);
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('WEBP conversion failed.')), 'image/png');
      });
      return pdf.embedPng(arrayBufferFromBytes(new Uint8Array(await pngBlob.arrayBuffer())));
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  throw new Error(`Unsupported image format: ${file.name}`);
}

export async function imagesToPdf(files: File[], options: ImageToPdfOptions): Promise<Blob> {
  if (!files.length) throw new Error('Select at least one image.');
  if (files.length > 50) throw new Error('A maximum of 50 images is supported.');

  const supported = files.filter((file) => {
    const mime = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp' || /\.(jpe?g|png|webp)$/.test(name);
  });
  if (supported.length !== files.length) throw new Error('Only JPG, PNG, and WEBP images are supported.');

  const pdf = await PDFDocument.create();
  const margin = MARGINS[options.margin];
  const standardPage = { portrait: { width: 612, height: 792 }, landscape: { width: 792, height: 612 } };

  for (const file of supported) {
    const dimensions = await loadImageDimensions(file);
    const orientation = normalizeOrientation(dimensions.width, dimensions.height, options.orientation);
    const pageSize = standardPage[orientation];
    const page = pdf.addPage([pageSize.width, pageSize.height]);
    const image = await embedImage(pdf, file);
    const availableWidth = Math.max(1, pageSize.width - margin * 2);
    const availableHeight = Math.max(1, pageSize.height - margin * 2);
    const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, {
      x: (pageSize.width - width) / 2,
      y: (pageSize.height - height) / 2,
      width,
      height,
    });
  }

  const bytes = await pdf.save({ useObjectStreams: true });
  return new Blob([arrayBufferFromBytes(bytes)], { type: 'application/pdf' });
}
