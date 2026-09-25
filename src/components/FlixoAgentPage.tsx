import { lazy, Suspense } from 'react';
import { Link } from '@tanstack/react-router';
import type { Locale } from '@/lib/i18n';
import { FlixoLogoImage } from './FlixoLogoImage';
import './agent-page.css';

const FlixoAIAgent = lazy(async () => {
  const module = await import('./FlixoAIAgent');
  return { default: module.FlixoAIAgent };
});

const LABELS: Readonly<Record<Locale, { home: string; tools: string; title: string }>> = {
  en: { home: 'Home', tools: 'Tools', title: 'FLIXO Agent' },
  ar: { home: 'الرئيسية', tools: 'الأدوات', title: 'وكيل FLIXO' },
  es: { home: 'Inicio', tools: 'Herramientas', title: 'Agente FLIXO' },
  fr: { home: 'Accueil', tools: 'Outils', title: 'Agent FLIXO' },
  de: { home: 'Startseite', tools: 'Tools', title: 'FLIXO-Agent' },
  hi: { home: 'होम', tools: 'टूल्स', title: 'FLIXO एजेंट' },
  id: { home: 'Beranda', tools: 'Alat', title: 'Agen FLIXO' },
  it: { home: 'Home', tools: 'Strumenti', title: 'Agente FLIXO' },
  ja: { home: 'ホーム', tools: 'ツール', title: 'FLIXOエージェント' },
  ko: { home: '홈', tools: '도구', title: 'FLIXO 에이전트' },
  ms: { home: 'Utama', tools: 'Alat', title: 'Ejen FLIXO' },
  nl: { home: 'Home', tools: 'Tools', title: 'FLIXO-agent' },
  pl: { home: 'Start', tools: 'Narzędzia', title: 'Agent FLIXO' },
  pt: { home: 'Início', tools: 'Ferramentas', title: 'Agente FLIXO' },
  ru: { home: 'Главная', tools: 'Инструменты', title: 'Агент FLIXO' },
  sv: { home: 'Hem', tools: 'Verktyg', title: 'FLIXO-agent' },
  th: { home: 'หน้าแรก', tools: 'เครื่องมือ', title: 'เอเจนต์ FLIXO' },
  tr: { home: 'Ana sayfa', tools: 'Araçlar', title: 'FLIXO ajanı' },
  uk: { home: 'Головна', tools: 'Інструменти', title: 'Агент FLIXO' },
  vi: { home: 'Trang chủ', tools: 'Công cụ', title: 'Tác nhân FLIXO' },
};

export function FlixoAgentPage({ locale = 'en' as Locale }: { locale?: Locale }) {
  const labels = LABELS[locale] ?? LABELS.en;
  const homePath = locale === 'en' ? '/' : '/$locale';
  const homeParams = locale === 'en' ? undefined : { locale };
  const toolsPath = locale === 'en' ? '/tools' : '/ar/tools';

  return (
    <main className="flixo-agent-page" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="flixo-agent-page__nav">
        <div className="flixo-agent-page__nav-inner">
          <Link
            className="flixo-agent-page__brand"
            to={homePath as never}
            params={homeParams as never}
            aria-label={labels.home}
          >
            <FlixoLogoImage alt="FLIXO" width={34} height={34} />
            <span>{labels.title}</span>
          </Link>
          <nav className="flixo-agent-page__links" aria-label={labels.title}>
            <Link to={homePath as never} params={homeParams as never}>{labels.home}</Link>
            <Link to={toolsPath as never}>{labels.tools}</Link>
          </nav>
        </div>
      </header>
      <div className="flixo-agent-page__body">
        <div className="flixo-agent-page__studio">
          <Suspense fallback={<div className="flixo-agent-page__loading" role="status">Loading…</div>}>
            <FlixoAIAgent locale={locale} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
