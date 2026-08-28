import { createRoute } from '@tanstack/react-router';
import { getToolSeo } from '../lib/seo/tool-seo';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

function requireTool(path: string) {
  const tool = getToolConfigByPath(path);
  if (!tool) throw new Error(`Missing ToolConfig for ${path}`);
  if (!tool.isReady) throw new Error(`Tool route is not ready: ${path}`);
  return tool;
}

function toolHead(locale: 'en', toolId: string) {
  const seo = getToolSeo(locale, toolId);
  if (!seo) throw new Error(`Missing SEO manifest for ${locale}/${toolId}`);
  return {
    meta: [
      { title: seo.title },
      { name: 'description', content: seo.description },
      { name: 'robots', content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' },
      { property: 'og:title', content: seo.title },
      { property: 'og:description', content: seo.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: seo.url },
      { property: 'og:locale', content: seo.languageTag },
    ],
    links: [
      { rel: 'canonical', href: seo.url },
      ...seo.alternates.map((alternate) => ({ rel: 'alternate', hrefLang: alternate.languageTag, href: alternate.url })),
      { rel: 'alternate', hrefLang: 'x-default', href: seo.xDefaultUrl },
    ],
    scripts: [{ type: 'application/ld+json', children: JSON.stringify(seo.structuredData).replaceAll('<', '\\u003c') }],
  };
}

const mergerSplitterTool = requireTool('/en/pdf-merger-splitter');
const MergerSplitterComponent = mergerSplitterTool.component;

export const enPdfMergerSplitterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/pdf-merger-splitter',
  head: () => toolHead('en', 'pdf-merger-splitter'),
  component: () => <MergerSplitterComponent />,
});

const compressorTool = requireTool('/en/pdf-compressor');
const CompressorComponent = compressorTool.component;

export const enPdfCompressorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/pdf-compressor',
  head: () => toolHead('en', 'pdf-compressor'),
  component: () => <CompressorComponent />,
});

const imageToPdfTool = requireTool('/en/image-to-pdf');
const ImageToPdfComponent = imageToPdfTool.component;

export const enImageToPdfRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/image-to-pdf',
  head: () => toolHead('en', 'image-to-pdf'),
  component: () => <ImageToPdfComponent />,
});

const unlockProtectTool = requireTool('/en/pdf-unlock-protect');
const UnlockProtectComponent = unlockProtectTool.component;

export const enPdfUnlockProtectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/pdf-unlock-protect',
  head: () => toolHead('en', 'pdf-unlock-protect'),
  component: () => <UnlockProtectComponent />,
});

const pdfToTextTool = requireTool('/en/pdf-to-text');
const PdfToTextComponent = pdfToTextTool.component;

export const enPdfToTextRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/pdf-to-text',
  head: () => toolHead('en', 'pdf-to-text'),
  component: () => <PdfToTextComponent />,
});
