import { useEffect } from 'react';
import { FlixoLogoImage } from './FlixoLogoImage';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Locale } from '@/lib/i18n';
import { getHomeCopy } from '../data/home-locales';
import { LOCALES } from '../lib/i18n';
import { FlixoAIAgent } from './FlixoAIAgent';
import './agent-first-home.css';

const IMAGE_TOOLS_LABELS: Record<Locale, string> = {
  en: 'Image Tools', ar: 'أدوات الصور', es: 'Herramientas de imágenes', fr: 'Outils image', de: 'Bildtools',
  hi: 'इमेज टूल्स', id: 'Alat gambar', it: 'Strumenti immagini', ja: '画像ツール', ko: '이미지 도구',
  ms: 'Alat imej', nl: 'Afbeeldingstools', pl: 'Narzędzia obrazów', pt: 'Ferramentas de imagem',
  ru: 'Инструменты изображений', sv: 'Bildverktyg', th: 'เครื่องมือรูปภาพ', tr: 'Görsel araçları',
  uk: 'Інструменти зображень', vi: 'Công cụ hình ảnh',
};

const FILTER_LABELS: Record<Locale, string> = {
  en: 'Filters', ar: 'الفلاتر', es: 'Filtros', fr: 'Filtres', de: 'Filter',
  hi: 'फ़िल्टर', id: 'Filter', it: 'Filtri', ja: 'フィルター', ko: '필터',
  ms: 'Penapis', nl: 'Filters', pl: 'Filtry', pt: 'Filtros', ru: 'Фильтры',
  sv: 'Filter', th: 'ฟิลเตอร์', tr: 'Filtreler', uk: 'Фільтри', vi: 'Bộ lọc',
};

const LANGUAGE_LABELS: Record<Locale, string> = {
  en: 'English', ar: 'العربية', es: 'Español', fr: 'Français', de: 'Deutsch',
  hi: 'हिन्दी', id: 'Bahasa Indonesia', it: 'Italiano', ja: '日本語', ko: '한국어',
  ms: 'Bahasa Melayu', nl: 'Nederlands', pl: 'Polski', pt: 'Português', ru: 'Русский',
  sv: 'Svenska', th: 'ไทย', tr: 'Türkçe', uk: 'Українська', vi: 'Tiếng Việt',
};

const COPY = {
  ar: {
    title: 'FLIXO',
    subtitle: 'وكيلك الذكي لتعديل الصور',
    hint: 'ارفع صورة واطلب ما تريد تعديله. FLIXO يفهم الهدف ويختار طريقة التنفيذ.',
  },
  en: {
    title: 'FLIXO',
    subtitle: 'Your AI image editing agent',
    hint: 'Upload an image and describe what you want changed. FLIXO plans the edit and executes it.',
  },
} as const;

export function AgentFirstHome({ locale = 'en' as Locale }: { locale?: Locale }) {
  const navigate = useNavigate();
  const copy = COPY[locale === 'ar' ? 'ar' : 'en'];
  const home = getHomeCopy(locale);
  function renderHeroTitle(value: string) {
    const opening = '[[';
    const closing = ']]';
    const openingIndex = value.indexOf(opening);
    if (openingIndex === -1) return value;

    const contentStart = openingIndex + opening.length;
    const closingIndex = value.indexOf(closing, contentStart);
    if (closingIndex === -1) return value;

    return (
      <>
        {value.slice(0, openingIndex)}
        <span>{value.slice(contentStart, closingIndex)}</span>
        {value.slice(closingIndex + closing.length)}
      </>
    );
  }

  useEffect(() => {
    document.documentElement.lang = home.language;
    document.documentElement.dir = home.dir;
  }, [home.dir, home.language]);

  return (
    <main className="agent-first-home" lang={locale} dir={home.dir}>
      <header className="agent-first-nav">
        {locale === 'en' ? (
          <Link className="agent-first-brand" to="/" aria-label={copy.title}>
            <FlixoLogoImage alt="FLIXO AI Tools" width={40} height={40} />
          </Link>
        ) : (
          <Link className="agent-first-brand" to="/$locale" params={{ locale }} aria-label={copy.title}>
            <FlixoLogoImage alt="FLIXO AI Tools" width={40} height={40} />
          </Link>
        )}
        <nav className="agent-first-nav-actions" aria-label={home.ariaPrimary}>
          <Link className="agent-first-tools-button" to="/$locale/$tool" params={{ locale, tool: 'image-compressor' }}>{IMAGE_TOOLS_LABELS[locale]}</Link>
          <Link className="agent-first-tools-button" to="/$locale/$tool" params={{ locale, tool: 'pix' }}>{FILTER_LABELS[locale]}</Link>
          <label className="sr-only" htmlFor="home-language">{home.nav.switch}</label>
          <select
            id="home-language"
            className="agent-first-language"
            value={locale}
            aria-label={home.nav.switch}
            onChange={(event) => {
              const nextLocale = event.target.value as Locale;
              void navigate(nextLocale === 'en' ? { to: '/' } : { to: '/$locale', params: { locale: nextLocale } });
            }}
          >
            {LOCALES.map((code) => (
              <option key={code} value={code}>{LANGUAGE_LABELS[code]}</option>
            ))}
          </select>
        </nav>
      </header>
      <section className="agent-first-main" aria-labelledby="agent-first-title">
        <div className="agent-first-heading">
          <span className="agent-first-mark" aria-hidden="true">✦</span>
          <h1 id="home-title">{renderHeroTitle(home.heroTitle)}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="agent-first-chat"><FlixoAIAgent locale={locale} /></div>
        <p className="agent-first-hint">{copy.hint}</p>
      </section>
    </main>
  );
}
