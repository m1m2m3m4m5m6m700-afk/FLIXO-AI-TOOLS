import { useLayoutEffect } from 'react';
import { applyDocumentLocale, installDocumentLocaleContract } from '@/lib/i18n/runtime-document-locale';

export interface RuntimeLocaleAttributesProps {
  locale: string;
}

export function RuntimeLocaleAttributes({ locale }: RuntimeLocaleAttributesProps) {
  useLayoutEffect(() => {
    applyDocumentLocale(locale);
    return installDocumentLocaleContract();
  }, [locale]);

  return null;
}
