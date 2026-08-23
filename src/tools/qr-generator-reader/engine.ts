import QRCode from 'qrcode';

export type QrPayloadType = 'text' | 'url' | 'wifi' | 'vcard';

export type QrOptions = {
  type: QrPayloadType;
  value: string;
  foreground?: string;
  background?: string;
  width?: number;
};

export function buildQrPayload(type: QrPayloadType, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('QR content is required.');
  if (type === 'wifi') {
    const [ssid = '', password = '', security = 'WPA'] = trimmed.split('|');
    if (!ssid) throw new Error('Wi-Fi SSID is required.');
    return `WIFI:T:${security};S:${ssid};P:${password};;`;
  }
  if (type === 'vcard') {
    return `BEGIN:VCARD\nVERSION:3.0\nFN:${trimmed}\nEND:VCARD`;
  }
  return trimmed;
}

export async function renderQrDataUrl(options: QrOptions): Promise<string> {
  const payload = buildQrPayload(options.type, options.value);
  return QRCode.toDataURL(payload, {
    width: options.width ?? 320,
    margin: 2,
    color: {
      dark: options.foreground ?? '#111827',
      light: options.background ?? '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
}

export async function renderQrSvg(options: QrOptions): Promise<string> {
  const payload = buildQrPayload(options.type, options.value);
  return QRCode.toString(payload, {
    type: 'svg',
    width: options.width ?? 320,
    margin: 2,
    color: {
      dark: options.foreground ?? '#111827',
      light: options.background ?? '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
}

export async function scanQrFile(file: File): Promise<string> {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
    throw new Error('QR scanning is not supported by this browser.');
  }

  const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
  const bitmap = await createImageBitmap(file);
  try {
    const results = await detector.detect(bitmap);
    if (!results.length) throw new Error('No QR code detected.');
    return results[0].rawValue;
  } finally {
    bitmap.close();
  }
}

declare global {
  interface BarcodeDetectorOptions { formats?: string[]; }
  interface DetectedBarcode { rawValue: string; }
  interface BarcodeDetector {
    detect(image: ImageBitmap): Promise<DetectedBarcode[]>;
  }
  interface BarcodeDetectorConstructor { new(options?: BarcodeDetectorOptions): BarcodeDetector; }
  interface Window { BarcodeDetector: BarcodeDetectorConstructor; }
}
