import { ImageCompressor } from './index';

export function EnglishImageCompressorPage() {
  return <ImageCompressor locale="en" />;
}

export function ArabicImageCompressorPage() {
  return (
    <>
      <nav aria-label="التنقل بين اللغات">
        <a lang="en" href="/en/image-compressor">English</a>
      </nav>
      <ImageCompressor locale="ar" />
    </>
  );
}
