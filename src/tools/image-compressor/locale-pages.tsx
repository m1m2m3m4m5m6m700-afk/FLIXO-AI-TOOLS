import { useEffect } from 'react';
import { ImageCompressor } from './index';

export function EnglishImageCompressorPage() {
  useEffect(() => {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    return () => {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
    };
  }, []);

  return <ImageCompressor locale="en" />;
}

export function ArabicImageCompressorPage() {
  useEffect(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    return () => {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
    };
  }, []);

  return (
    <>
      <nav aria-label="التنقل بين اللغات">
        <a lang="en" href="/en/image-compressor">English</a>
      </nav>
      <ImageCompressor locale="ar" />
    </>
  );
}
