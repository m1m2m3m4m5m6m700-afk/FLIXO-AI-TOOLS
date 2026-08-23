import { PDFDocument, degrees } from 'pdf-lib';

export type PdfPageRef = {
  id: string;
  sourceIndex: number;
  pageIndex: number;
  label: string;
  rotation: number;
};

export type PdfSource = {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
};

export type PdfSplitRange = {
  start: number;
  end: number;
};

export function normalizeRotation(rotation: number) {
  const value = rotation % 360;
  return value < 0 ? value + 360 : value;
}

export function parsePageRange(value: string, pageCount: number): PdfSplitRange {
  const cleaned = value.trim();
  if (!cleaned) throw new Error('Enter a page range such as 1-3 or 2.');
  const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(cleaned);
  if (!match) throw new Error('Invalid page range. Use 1-3 or 2.');
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > pageCount) {
    throw new Error(`Page range must be between 1 and ${pageCount}.`);
  }
  return { start, end };
}

export function reorderPages(pages: PdfPageRef[], from: number, to: number) {
  if (from < 0 || from >= pages.length || to < 0 || to >= pages.length) return pages;
  const next = [...pages];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function rotatePage(page: PdfPageRef, delta = 90): PdfPageRef {
  return { ...page, rotation: normalizeRotation(page.rotation + delta) };
}

export async function readPdfSource(file: File, sourceIndex: number): Promise<PdfSource> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error(`${file.name} is not a PDF file.`);
  }
  if (file.size === 0) throw new Error(`${file.name} is empty.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await PDFDocument.load(bytes);
  return { id: `${sourceIndex}-${file.name}-${file.size}`, name: file.name, bytes, pageCount: pdf.getPageCount() };
}

export function createPageRefs(source: PdfSource): PdfPageRef[] {
  return Array.from({ length: source.pageCount }, (_, index) => ({
    id: `${source.id}-page-${index + 1}`,
    sourceIndex: Number(source.id.split('-')[0]),
    pageIndex: index,
    label: `${source.name} · ${index + 1}`,
    rotation: 0,
  }));
}

export async function mergePdfPages(sources: PdfSource[], pages: PdfPageRef[]) {
  if (!pages.length) throw new Error('No PDF pages selected.');
  const output = await PDFDocument.create();
  const sourceDocs = await Promise.all(sources.map((source) => PDFDocument.load(source.bytes)));
  for (const ref of pages) {
    const source = sourceDocs[ref.sourceIndex];
    if (!source) throw new Error('Invalid source PDF reference.');
    const [copied] = await output.copyPages(source, [ref.pageIndex]);
    copied.setRotation(degrees(normalizeRotation(ref.rotation)));
    output.addPage(copied);
  }
  return output.save({ useObjectStreams: true });
}

export async function splitPdf(file: File, range: PdfSplitRange) {
  const source = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()));
  const output = await PDFDocument.create();
  const indexes = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start - 1 + offset);
  const pages = await output.copyPages(source, indexes);
  pages.forEach((page) => output.addPage(page));
  return output.save({ useObjectStreams: true });
}
