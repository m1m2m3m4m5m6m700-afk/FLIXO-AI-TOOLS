import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();

export type PdfTextPage = {
  pageNumber: number;
  text: string;
  wordCount: number;
};

export type PdfTextExtraction = {
  pages: PdfTextPage[];
  text: string;
  wordCount: number;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function countWords(text: string): number {
  const normalized = text.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

function normalizePdfText(value: string): string {
  return value.replace(/[ \t]+/gu, ' ').trim();
}

async function extractPages(pdf: PDFDocumentProxy): Promise<PdfTextPage[]> {
  const pages: PdfTextPage[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = normalizePdfText(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    pages.push({ pageNumber, text, wordCount: countWords(text) });
    page.cleanup();
  }
  return pages;
}

export async function extractPdfText(file: File): Promise<PdfTextExtraction> {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('Please select a PDF file.');
  }
  if (file.size === 0) throw new Error('The PDF file is empty.');
  if (file.size > 75 * 1024 * 1024) throw new Error('PDFs larger than 75 MB are not supported in the browser.');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data: toArrayBuffer(bytes) });
  const pdf = await loadingTask.promise;

  try {
    const pages = await extractPages(pdf);
    const text = pages.map((page) => page.text).filter(Boolean).join('\n\n');
    return { pages, text, wordCount: countWords(text) };
  } finally {
    await loadingTask.destroy();
  }
}

export function exportText(extraction: PdfTextExtraction): string {
  return extraction.text;
}

export function exportJson(extraction: PdfTextExtraction): string {
  return JSON.stringify(extraction.pages, null, 2);
}
