import { lazy, Suspense } from 'react';

const ImageCompressor = lazy(() => import('@/tools/image-compressor').then((module) => ({ default: module.ImageCompressor })));

export function LazyImageCompressor({ locale = 'en' }: { locale?: 'en' | 'ar' }) {
  return (
    <Suspense fallback={<div className="image-tool-shell" aria-busy="true" />}>
      <ImageCompressor locale={locale} />
    </Suspense>
  );
}
