import type { HomeCopy } from '../../data/home-locales';
import type { QuickFlowCopy } from '../../data/quickflow-locales';
import type { Locale } from './config';

export type HomeCopyOverride = Partial<HomeCopy>;
export type QuickFlowCopyOverride = Partial<QuickFlowCopy>;

/** Human-reviewed corrections for phrasing that needs full-sentence context. */
export const HOME_COPY_OVERRIDES: Readonly<Partial<Record<Locale, HomeCopyOverride>>> = Object.freeze({
  ar: Object.freeze({
    browserMeta: 'معالجة داخل المتصفح · بدء فوري',
    quickDrop: 'السحب السريع',
    builtForFocus: 'مصمم للتركيز',
  }),
  id: Object.freeze({
    badge: 'Utamakan privasi · Utamakan browser',
    browserMeta: 'Di browser · Mulai instan',
    quickDrop: 'LETAKKAN CEPAT',
  }),
  pl: Object.freeze({
    quickDrop: 'SZYBKIE DODAWANIE',
    browserMeta: 'W przeglądarce · Natychmiastowy start',
  }),
  tr: Object.freeze({
    browserMeta: 'Tarayıcı öncelikli · Anında başla',
  }),
  sv: Object.freeze({
    browserMeta: 'Webbläsare först · Starta direkt',
    trust: [
      ['Webbläsare först', 'Lokal bearbetning där verktyget stöder det.'],
      ['Snabb start', 'Direkta vägar utan onödig introduktion.'],
      ['Smart dirigering', 'Vanliga uppgifter går direkt till det bästa tillgängliga verktyget.'],
    ],
  }),
});

export const QUICKFLOW_COPY_OVERRIDES: Readonly<Partial<Record<Locale, QuickFlowCopyOverride>>> = Object.freeze({
  ar: Object.freeze({ missing: 'تعذّر العثور على QuickFlow', processing: 'تتم المعالجة داخل المتصفح.', result: 'النتيجة جاهزة', failure: 'تعذّر إكمال مسار العمل.' }),
  id: Object.freeze({ failure: 'Alur kerja tidak dapat diselesaikan.', processing: 'Pemrosesan berlangsung di browser Anda.' }),
  pl: Object.freeze({ failure: 'Nie udało się ukończyć przepływu pracy.', processing: 'Przetwarzanie odbywa się w przeglądarce.' }),
  tr: Object.freeze({ failure: 'İş akışı tamamlanamadı.', processing: 'İşleme tarayıcınızda gerçekleştirilir.' }),
  sv: Object.freeze({ failure: 'Arbetsflödet kunde inte slutföras.', processing: 'Bearbetningen sker i webbläsaren.' }),
});