export type UseCaseFaq = {
  question: string;
  answer: string;
};

export type UseCase = {
  slug: string;
  title: string;
  description: string;
  toolIds: readonly string[];
  faq: readonly UseCaseFaq[];
};

export const USE_CASES: readonly UseCase[] = Object.freeze([
  { slug: 'optimize-images-for-web', title: 'Optimize Images for the Web', description: 'Compress, convert, and resize images for faster websites while keeping processing local where supported.', toolIds: ['image-compressor', 'image-converter', 'image-cropper'], faq: [
    { question: 'How do I optimize images for a website?', answer: 'Compress the image, convert it to a suitable web format, and resize it to the dimensions the page actually needs.' },
    { question: 'Does FLIXO upload my image?', answer: 'Tools marked local process files in the browser. Tools that use external services are labeled separately on their tool page.' },
  ] },
  { slug: 'prepare-social-media-images', title: 'Prepare Images for Social Media', description: 'Resize and convert images into practical formats for social media publishing.', toolIds: ['image-cropper', 'image-converter', 'watermark-adder'], faq: [
    { question: 'What is the fastest way to prepare an image for social media?', answer: 'Crop it to the target composition, resize it to the required dimensions, then export it in a supported format.' },
    { question: 'Can I add a watermark before publishing?', answer: 'Yes. Use FLIXO Watermark Adder as the final step in the workflow before downloading the image.' },
  ] },
  { slug: 'clean-and-convert-images', title: 'Clean and Convert Images', description: 'Clean image metadata and convert assets into formats suitable for sharing and publishing.', toolIds: ['exif-cleaner', 'image-converter', 'image-to-svg'], faq: [
    { question: 'Why remove EXIF metadata from an image?', answer: 'Removing EXIF data can reduce unnecessary metadata such as camera details and location fields before sharing an image.' },
    { question: 'When should I convert an image to SVG?', answer: 'SVG is useful when the source is suitable for vector representation and you need scalable graphics for interfaces or publishing.' },
  ] },
]);

export function getUseCase(slug: string): UseCase | null {
  return USE_CASES.find((useCase) => useCase.slug === slug) ?? null;
}
