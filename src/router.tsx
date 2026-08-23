import { createRouter } from '@tanstack/react-router';
import { arIndexRoute } from './routes/ar-index';
import { arImageCompressorRoute } from './routes/ar-image-compressor';
import { arQuickFlowRoute } from './routes/ar-quickflow';
import { enImageCompressorRoute } from './routes/en-image-compressor';
import { enQuickFlowRoute } from './routes/en-quickflow';
import { enPdfMergerSplitterRoute } from './routes/pdf-tools';
import { localizedHomeRoute } from './routes/localized-home';
import { localizedQuickFlowRoute } from './routes/localized-quickflow';
import {
  enAiImageGeneratorRoute,
  enBackgroundBlurRoute,
  enBackgroundRemoverRoute,
  enCollageMakerRoute,
  enCropResizeRoute,
  enExifCleanerRoute,
  enImageConverterRoute,
  enImageCropperRoute,
  enImageEffectsRoute,
  enImageOcrRoute,
  enImageToSvgRoute,
  enImageToTextRoute,
  enImageUpscalerRoute,
  enMemeGeneratorRoute,
  enMockupGeneratorRoute,
  enObjectRemoverRoute,
  enPassportPhotoMakerRoute,
  enPixRoute,
  enRasterToSvgRoute,
  enSeedRoute,
  enSvgOptimizerRoute,
  enWatermarkAdderRoute,
  enWatermarkRemoverRoute,
} from './routes/image-tools';
import { indexRoute } from './routes/index';
import { localizedToolRoute } from './routes/localized-tool';
import { rootRoute } from './routes/__root';

const routeTree = rootRoute.addChildren([
  indexRoute,
  arIndexRoute,
  localizedHomeRoute,
  enImageCompressorRoute,
  arImageCompressorRoute,
  enQuickFlowRoute,
  arQuickFlowRoute,
  localizedQuickFlowRoute,
  enPdfMergerSplitterRoute,
  enBackgroundRemoverRoute,
  enAiImageGeneratorRoute,
  enImageUpscalerRoute,
  enImageConverterRoute,
  enImageToTextRoute,
  enObjectRemoverRoute,
  enCropResizeRoute,
  enWatermarkRemoverRoute,
  enRasterToSvgRoute,
  enImageCropperRoute,
  enImageOcrRoute,
  enBackgroundBlurRoute,
  enPassportPhotoMakerRoute,
  enWatermarkAdderRoute,
  enMemeGeneratorRoute,
  enCollageMakerRoute,
  enImageEffectsRoute,
  enExifCleanerRoute,
  enSvgOptimizerRoute,
  enMockupGeneratorRoute,
  enImageToSvgRoute,
  enSeedRoute,
  enPixRoute,
  localizedToolRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}
