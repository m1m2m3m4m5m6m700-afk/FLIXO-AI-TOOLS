import { createRoute } from '@tanstack/react-router';
import { getToolConfigByPath } from '../config/tools';
import { rootRoute } from './__root';

const config = getToolConfigByPath('/en/qr-generator-reader');
if (!config?.isReady) throw new Error('QR Generator & Reader route is not ready');
const QrComponent = config.component;

export const enQrGeneratorReaderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/qr-generator-reader',
  head: () => ({ meta: [
    { title: 'QR Code Generator & Reader | FLIXO' },
    { name: 'description', content: 'Generate QR codes and read QR images locally in your browser.' },
    { name: 'robots', content: 'index,follow,max-image-preview:large' },
    { property: 'og:title', content: 'QR Code Generator & Reader | FLIXO' },
    { property: 'og:description', content: 'Generate QR codes and read QR images locally in your browser.' },
    { property: 'og:type', content: 'website' },
  ] }),
  component: () => <QrComponent />,
});
