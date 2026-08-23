import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import { decryptPDF, isEncrypted } from '@pdfsmaller/pdf-decrypt';

export type PdfSecurityMode = 'protect' | 'unlock';
export type PdfPermission = 'printing' | 'copying' | 'modifying' | 'annotating' | 'fillingForms' | 'extracting' | 'assembly' | 'highQualityPrint';

export type PdfProtectionOptions = {
  userPassword: string;
  ownerPassword?: string;
  permissions?: Partial<Record<PdfPermission, boolean>>;
};

export type PdfSecurityResult = {
  bytes: Uint8Array;
  filenameSuffix: string;
};

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function normalizePermissions(permissions: PdfProtectionOptions['permissions']) {
  return {
    allowPrinting: permissions?.printing ?? true,
    allowCopying: permissions?.copying ?? true,
    allowModifying: permissions?.modifying ?? true,
    allowAnnotating: permissions?.annotating ?? true,
    allowFillingForms: permissions?.fillingForms ?? true,
    allowExtraction: permissions?.extracting ?? true,
    allowAssembly: permissions?.assembly ?? true,
    allowHighQualityPrint: permissions?.highQualityPrint ?? true,
  };
}

export async function protectPdf(file: File, options: PdfProtectionOptions): Promise<PdfSecurityResult> {
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please select a PDF file.');
  }
  if (!options.userPassword) throw new Error('Enter a password.');
  if (file.size <= 0) throw new Error('The PDF file is empty.');
  if (file.size > 75 * 1024 * 1024) throw new Error('PDFs larger than 75 MB are not supported in the browser.');

  const input = new Uint8Array(await file.arrayBuffer());
  const encryptedInfo = await isEncrypted(input);
  if (encryptedInfo.encrypted) throw new Error('This PDF is already password-protected. Unlock it before protecting it again.');

  const encrypted = await encryptPDF(input, options.userPassword, {
    ownerPassword: options.ownerPassword || options.userPassword,
    ...normalizePermissions(options.permissions),
  });

  return {
    bytes: new Uint8Array(encrypted),
    filenameSuffix: '-protected',
  };
}

export async function unlockPdf(file: File, password: string): Promise<PdfSecurityResult> {
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please select a PDF file.');
  }
  if (file.size <= 0) throw new Error('The PDF file is empty.');
  if (file.size > 75 * 1024 * 1024) throw new Error('PDFs larger than 75 MB are not supported in the browser.');
  if (password.length === 0) throw new Error('Enter the PDF password.');

  const input = new Uint8Array(await file.arrayBuffer());
  const encryptedInfo = await isEncrypted(input);
  if (!encryptedInfo.encrypted) throw new Error('This PDF is not password-protected.');

  let decrypted: Uint8Array;
  try {
    decrypted = new Uint8Array(await decryptPDF(input, password));
  } catch {
    throw new Error('Incorrect password or unsupported PDF encryption.');
  }

  return {
    bytes: decrypted,
    filenameSuffix: '-unlocked',
  };
}

export function bytesToPdfBlob(bytes: Uint8Array): Blob {
  return new Blob([asArrayBuffer(bytes)], { type: 'application/pdf' });
}
