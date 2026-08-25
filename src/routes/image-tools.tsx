import { lazy } from 'react';
import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const LazyToolChainPanel = lazy(() => import('../components/tool-chain-panel').then((module) => ({ default: module.ToolChainPanel })));

type ToolRouteConfig = {
  path: string;
  title?: string;
  description?: string;
};

function imageToolRoute({ path, title: titleOverride, description: descriptionOverride }: ToolRouteConfig) {
  const tool = getToolConfigByPath(path);
  if (!tool) throw new Error(`Missing ToolConfig for route: ${path}`);
  if (!tool.isReady) throw new Error(`Route points to a non-ready tool: ${path}`);

  const title = titleOverride ?? tool.title;
  const description = descriptionOverride ?? tool.description;
  const ToolComponent = tool.component;

  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    head: () => ({ meta: [
      { title: `${title} | FLIXO` },
      { name: 'description', content: description },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { property: 'og:title', content: `${title} | FLIXO` },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
    ] }),
    component: () => (
      <>
        <LazyToolChainPanel currentToolId={tool.id} />
        <ToolComponent />
      </>
    ),
  });
}

export const enBackgroundRemoverRoute = imageToolRoute({ path: '/en/background-remover' });
export const enAiImageGeneratorRoute = imageToolRoute({ path: '/en/ai-image-generator' });
export const enImageUpscalerRoute = imageToolRoute({ path: '/en/image-upscaler' });
export const enImageConverterRoute = imageToolRoute({ path: '/en/image-converter' });
export const enImageToTextRoute = imageToolRoute({ path: '/en/image-to-text' });
export const enObjectRemoverRoute = imageToolRoute({ path: '/en/object-remover' });
export const enCropResizeRoute = imageToolRoute({ path: '/en/crop-resize', title: 'Crop & Resize', description: 'Legacy route for crop/resize.' });
export const enWatermarkRemoverRoute = imageToolRoute({ path: '/en/watermark-remover' });
export const enRasterToSvgRoute = imageToolRoute({ path: '/en/raster-to-svg', title: 'Raster to SVG', description: 'Legacy raster-to-SVG route.' });
export const enImageCropperRoute = imageToolRoute({ path: '/en/image-cropper' });
export const enImageOcrRoute = imageToolRoute({ path: '/en/image-ocr' });
export const enBackgroundBlurRoute = imageToolRoute({ path: '/en/background-blur' });
export const enPassportPhotoMakerRoute = imageToolRoute({ path: '/en/passport-photo-maker' });
export const enWatermarkAdderRoute = imageToolRoute({ path: '/en/watermark-adder' });
export const enMemeGeneratorRoute = imageToolRoute({ path: '/en/meme-generator' });
export const enCollageMakerRoute = imageToolRoute({ path: '/en/collage-maker' });
export const enImageEffectsRoute = imageToolRoute({ path: '/en/image-effects' });
export const enExifCleanerRoute = imageToolRoute({ path: '/en/exif-cleaner' });
export const enSvgOptimizerRoute = imageToolRoute({ path: '/en/svg-optimizer' });
export const enMockupGeneratorRoute = imageToolRoute({ path: '/en/mockup-generator' });
export const enImageToSvgRoute = imageToolRoute({ path: '/en/image-to-svg' });
export const enSeedRoute = imageToolRoute({ path: '/en/seed' });
export const enPixRoute = imageToolRoute({ path: '/en/pix' });
