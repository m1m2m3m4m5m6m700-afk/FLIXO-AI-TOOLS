import { useEffect, useRef } from 'react';
import { LOCALES, isLocale, normalizeLocale, type CanonicalLocale } from '@/lib/i18n';
import { trackUserMovement } from '@/lib/telemetry/telemetry-tracker';

type ElegantAdSlotProps = {
  slotId?: string;
  className?: string;
  monetizedLocales?: readonly CanonicalLocale[];
  adHref?: string;
};

const FALLBACK_COPY: Record<CanonicalLocale, { title: string; body: string; action: string }> = {
  ar: { title: 'FLIXO AI يعمل على توسيع التغطية الإعلانية', body: 'هذه المساحة مخصصة للإعلانات. في هذا البلد، نعرض رسالة بديلة بدلًا من وحدة إعلانية غير متاحة.', action: 'استكشاف FLIXO AI' },
  en: { title: 'Advertising coverage is expanding', body: 'This space is reserved for ads. A lightweight fallback is shown while this locale is not monetized.', action: 'Explore FLIXO AI' },
  es: { title: 'La cobertura publicitaria está creciendo', body: 'Este espacio está reservado para anuncios. Mostramos una alternativa ligera mientras este idioma no está monetizado.', action: 'Explorar FLIXO AI' },
  fr: { title: 'La couverture publicitaire s’étend', body: 'Cet espace est réservé aux annonces. Une alternative légère est affichée tant que cette langue n’est pas monétisée.', action: 'Découvrir FLIXO AI' },
  de: { title: 'Die Werbeabdeckung wird erweitert', body: 'Dieser Bereich ist für Anzeigen reserviert. Solange diese Sprache nicht monetarisiert ist, wird eine leichte Alternative angezeigt.', action: 'FLIXO AI entdecken' },
  hi: { title: 'विज्ञापन कवरेज का विस्तार हो रहा है', body: 'यह स्थान विज्ञापनों के लिए आरक्षित है। इस भाषा के मुद्रीकरण तक हल्का fallback दिखाया जाता है।', action: 'FLIXO AI देखें' },
  id: { title: 'Jangkauan iklan sedang diperluas', body: 'Ruang ini disediakan untuk iklan. Fallback ringan ditampilkan saat bahasa ini belum dimonetisasi.', action: 'Jelajahi FLIXO AI' },
  it: { title: 'La copertura pubblicitaria è in espansione', body: 'Questo spazio è riservato agli annunci. Mostriamo un fallback leggero finché questa lingua non è monetizzata.', action: 'Scopri FLIXO AI' },
  ja: { title: '広告対象地域を拡大しています', body: 'このスペースは広告用です。この言語が収益化されるまでは、軽量な代替表示を使用します。', action: 'FLIXO AI を見る' },
  ko: { title: '광고 지원 범위를 확대하고 있습니다', body: '이 공간은 광고용입니다. 이 언어가 수익화되기 전까지 가벼운 대체 배너를 표시합니다.', action: 'FLIXO AI 살펴보기' },
  ms: { title: 'Liputan iklan sedang diperluas', body: 'Ruang ini dikhaskan untuk iklan. Fallback ringan dipaparkan selagi bahasa ini belum dimonetisasi.', action: 'Terokai FLIXO AI' },
  nl: { title: 'Advertentiedekking wordt uitgebreid', body: 'Deze ruimte is gereserveerd voor advertenties. Tot deze taal is gemonetiseerd, tonen we een lichte fallback.', action: 'FLIXO AI ontdekken' },
  pl: { title: 'Zasięg reklam jest rozszerzany', body: 'To miejsce jest przeznaczone na reklamy. Dopóki ten język nie jest monetyzowany, wyświetlamy lekką alternatywę.', action: 'Poznaj FLIXO AI' },
  pt: { title: 'A cobertura de anúncios está a ser expandida', body: 'Este espaço é reservado para anúncios. Enquanto este idioma não for monetizado, mostramos uma alternativa leve.', action: 'Explorar FLIXO AI' },
  ru: { title: 'Рекламное покрытие расширяется', body: 'Это место предназначено для рекламы. Пока этот язык не монетизируется, показывается лёгкая замена.', action: 'Открыть FLIXO AI' },
  sv: { title: 'Annonsbevakningen byggs ut', body: 'Detta utrymme är reserverat för annonser. En lätt reservbanner visas tills språket är monetiserat.', action: 'Utforska FLIXO AI' },
  th: { title: 'กำลังขยายการรองรับโฆษณา', body: 'พื้นที่นี้จัดไว้สำหรับโฆษณา โดยจะแสดงแบนเนอร์สำรองแบบเบาจนกว่าภาษานี้จะเปิดสร้างรายได้', action: 'สำรวจ FLIXO AI' },
  tr: { title: 'Reklam kapsamı genişletiliyor', body: 'Bu alan reklamlar için ayrılmıştır. Bu dil para kazandırma kapsamına girene kadar hafif bir yedek gösterilir.', action: 'FLIXO AI'ı keşfet' },
  uk: { title: 'Рекламне покриття розширюється', body: 'Цей простір призначено для реклами. Поки цю мову не монетизовано, показується легкий резервний банер.', action: 'Відкрити FLIXO AI' },
  vi: { title: 'Phạm vi quảng cáo đang được mở rộng', body: 'Khu vực này dành cho quảng cáo. Trong khi ngôn ngữ này chưa được kiếm tiền, một banner thay thế nhẹ sẽ được hiển thị.', action: 'Khám phá FLIXO AI' },
};

function getCurrentLocale(): CanonicalLocale {
  const value = typeof document === 'undefined' ? 'en' : document.documentElement.lang;
  return isLocale(value.toLowerCase().split('-')[0]) ? normalizeLocale(value) : 'en';
}

export function ElegantAdSlot({ slotId = 'default', className = '', monetizedLocales = ['en'], adHref = '/' }: ElegantAdSlotProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const impressionTracked = useRef(false);
  const locale = getCurrentLocale();
  const isMonetized = monetizedLocales.includes(locale);
  const copy = FALLBACK_COPY[locale];

  useEffect(() => {
    const element = slotRef.current;
    if (!element || impressionTracked.current) return;
    const emit = () => {
      if (impressionTracked.current) return;
      impressionTracked.current = true;
      trackUserMovement('ad_impression', { slotId, locale, monetized: isMonetized });
    };

    if (typeof IntersectionObserver === 'undefined') {
      emit();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) emit();
    }, { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isMonetized, locale, slotId]);

  return (
    <div
      ref={slotRef}
      data-ad-slot={slotId}
      data-monetized={isMonetized ? 'true' : 'false'}
      className={`mx-auto w-full max-w-[1480px] px-2 pb-2 sm:px-3 lg:px-4 ${className}`}
      aria-label="Advertisement"
    >
      <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/90 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.06)] transition dark:border-white/[0.08] dark:bg-zinc-950/80 dark:shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
        {isMonetized ? (
          <div className="min-h-[90px] text-center" data-ad-provider="native">
            <div className="flex min-h-[90px] items-center justify-center text-xs text-zinc-400 dark:text-zinc-500">
              <span>Advertisement</span>
            </div>
          </div>
        ) : (
          <a
            href={adHref}
            onClick={() => trackUserMovement('ad_clicked', { slotId, locale, monetized: false })}
            className="group flex min-h-[90px] items-center justify-between gap-4 rounded-xl px-3 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-violet-500/70"
            aria-label={copy.action}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          >
            <div className="min-w-0">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-violet-500/80 dark:text-violet-300/70">FLIXO AI</div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{copy.title}</div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">{copy.body}</p>
            </div>
            <span className="shrink-0 rounded-lg border border-violet-300/50 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-700 transition group-hover:bg-violet-500/15 dark:border-violet-400/20 dark:text-violet-200">
              {copy.action}
            </span>
          </a>
        )}
      </div>
    </div>
  );
}

export { LOCALES };
