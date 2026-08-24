export type UseCase = {
  slug: string;
  title: string;
  description: string;
  toolIds: readonly string[];
};

export const USE_CASES: readonly UseCase[] = Object.freeze([
  {
    slug: 'optimize-images-for-web',
    title: 'Optimize Images for the Web',
    description: 'Compress, convert, and resize images for faster websites while keeping processing local where supported.',
    toolIds: ['image-compressor', 'image-converter', 'image-cropper'],
  },
  {
    slug: 'prepare-social-media-images',
    title: 'Prepare Images for Social Media',
    description: 'Resize and convert images into practical formats for social media publishing.',
    toolIds: ['image-cropper', 'image-converter', 'watermark-adder'],
  },
  {
    slug: 'clean-and-convert-images',
    title: 'Clean and Convert Images',
    description: 'Clean image metadata and convert assets into formats suitable for sharing and publishing.',
    toolIds: ['exif-cleaner', 'image-converter', 'image-to-svg'],
  },
]);

export function getUseCase(slug: string): UseCase | null {
  return USE_CASES.find((useCase) => useCase.slug === slug) ?? null;
}
