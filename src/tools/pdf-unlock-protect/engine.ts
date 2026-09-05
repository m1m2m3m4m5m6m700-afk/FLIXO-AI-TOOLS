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

type EncryptModule = {
  encryptPDF: (bytes: Uint8Array, password: string, options?: Record<string, unknown>) => Promise<Uint8Array>;
};

type DecryptModule = {
  decryptPDF: (bytes: Uint8Array, password: string) => Promise<Uint8Array>;
  isEncrypted: (bytes: Uint8Array) => Promise<{ encrypted: boolean; algorithm?: string; version?: number; revision?: number; keyLength?: number }>;
};

const ENCRYPT_ENGINE_URL = 'https://cdn.jsdelivr.net/npm/@pdfsmaller/pdf-encrypt@1.2.0/+esm';
const DECRYPT_ENGINE_URL = 'https://cdn.jsdelivr.net/npm/@pdfsmaller/pdf-decrypt@1.0.1/+esm';

async function loadSecurityEngines(): Promise<{ encrypt: EncryptModule; decrypt: DecryptModule }> {
  const [encrypt, decrypt] = await Promise.all([
    import(/* @vite-ignore */ ENCRYPT_ENGINE_URL) as Promise<EncryptModule>,
    import(/* @vite-ignore */ DECRYPT_ENGINE_URL) as Promise<DecryptModule>,
  ]);
  return { encrypt, decrypt };
}

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

function validatePdfFile(file: File) {
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Please select a PDF file.');
  }
  if (file.size <= 0) throw new Error('The PDF file is empty.');
  if (file.size > 75 * 1024 * 1024) throw new Error('PDFs larger than 75 MB are not supported in the browser.');
}

export async function protectPdf(file: File, options: PdfProtectionOptions): Promise<PdfSecurityResult> {
  validatePdfFile(file);
  if (!options.userPassword) throw new Error('Enter a password.');

  const input = new Uint8Array(await file.arrayBuffer());
  const { encrypt, decrypt } = await loadSecurityEngines();
  const encryptedInfo = await decrypt.isEncrypted(input);
  if (encryptedInfo.encrypted) throw new Error('This PDF is already password-protected. Unlock it before protecting it again.');

  const encrypted = await encrypt.encryptPDF(input, options.userPassword, {
    ownerPassword: options.ownerPassword || options.userPassword,
    ...normalizePermissions(options.permissions),
  });

  return { bytes: new Uint8Array(encrypted), filenameSuffix: '-protected' };
}

export async function unlockPdf(file: File, password: string): Promise<PdfSecurityResult> {
  validatePdfFile(file);
  if (!password) throw new Error('Enter the PDF password.');

  const input = new Uint8Array(await file.arrayBuffer());
  const { decrypt } = await loadSecurityEngines();
  const encryptedInfo = await decrypt.isEncrypted(input);
  if (!encryptedInfo.encrypted) throw new Error('This PDF is not password-protected.');

  try {
    const decrypted = await decrypt.decryptPDF(input, password);
    return { bytes: new Uint8Array(decrypted), filenameSuffix: '-unlocked' };
  } catch {
    throw new Error('Incorrect password or unsupported PDF encryption.');
  }
}

export function bytesToPdfBlob(bytes: Uint8Array): Blob {
  return new Blob([asArrayBuffer(bytes)], { type: 'application/pdf' });
}
