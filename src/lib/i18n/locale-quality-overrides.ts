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
  es: Object.freeze({
    quickDrop: 'CARGA RÁPIDA',
    quickDropTitle: 'Suelta un archivo. Te indicaremos la herramienta adecuada.',
  }),
  id: Object.freeze({
    badge: 'Utamakan privasi · Utamakan browser',
    browserMeta: 'Di browser · Mulai instan',
    quickDrop: 'LETAKKAN CEPAT',
  }),
  it: Object.freeze({
    heroLead: 'Trova ciò che devi fare, apri lo strumento e completa il lavoro rapidamente. FLIXO mantiene l’esperienza focalizzata e usa l’elaborazione locale nel browser quando lo strumento la supporta.',
    quickDropTitle: 'Trascina un file. Ti indicheremo lo strumento giusto.',
  }),
  ja: Object.freeze({
    ariaTrust: '信頼のしるし',
  }),
  ko: Object.freeze({
    heroTitle: '맞는 도구를, <span>헤매지 않고.</span>',
  }),
  pl: Object.freeze({
    heroTitle: 'Właściwe narzędzie, <span>bez zbędnych kroków.</span>',
    quickDrop: 'SZYBKIE DODAWANIE',
    browserMeta: 'W przeglądarce · Natychmiastowy start',
  }),
  pt: Object.freeze({
    heroTitle: 'A ferramenta certa, <span>bez zbędnych kroków.</span>',
  }),
  ru: Object.freeze({
    quickDrop: 'БЫСТРОЕ ДОБАВЛЕНИЕ',
    ready: 'доступно',
  }),
  sv: Object.freeze({
    browserMeta: 'Webbläsare först · Starta direkt',
    trust: [
      ['Webbläsare först', 'Lokal bearbetning där verktyget stöds.'],
      ['Snabb start', 'Direkta vägar utan onödig introduktion.'],
      ['Smart dirigering', 'Vanliga uppgifter går direkt till det bästa tillgängliga verktyget.'],
    ] as [string, string][],
  }),
  tr: Object.freeze({
    quickDrop: 'HIZLI EKLEME',
    browserMeta: 'Tarayıcı öncelikli · Anında başla',
  }),
});

export const QUICKFLOW_COPY_OVERRIDES: Readonly<Partial<Record<Locale, QuickFlowCopyOverride>>> = Object.freeze({
  ar: Object.freeze({ missing: 'تعذّر العثور على QuickFlow', processing: 'تتم المعالجة داخل المتصفح.', result: 'النتيجة جاهزة', failure: 'تعذّر إكمال مسار العمل.' }),
  id: Object.freeze({ failure: 'Alur kerja tidak dapat diselesaikan.', processing: 'Pemrosesan berlangsung di browser Anda.' }),
  pl: Object.freeze({ failure: 'Nie udało się ukończyć przepływu pracy.', processing: 'Przetwarzanie odbywa się w przeglądarce.' }),
  tr: Object.freeze({ failure: 'İş akışı tamamlanamadı.', processing: 'İşleme tarayıcınızda gerçekleştirilir.' }),
  sv: Object.freeze({ failure: 'Arbetsflödet kunde inte slutföras.', processing: 'Bearbetningen sker i webbläsaren.' }),
});
