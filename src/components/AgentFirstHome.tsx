import { Link } from '@tanstack/react-router';
import { FlixoAIAgent } from './FlixoAIAgent';
import type { Locale } from '@/lib/i18n';
import './agent-first-home.css';

const COPY = {
  ar: { tools: 'تصفح الأدوات', newChat: 'محادثة جديدة', title: 'FLIXO', subtitle: 'ماذا تريد أن تنجز؟' },
  en: { tools: 'Browse tools', newChat: 'New chat', title: 'FLIXO', subtitle: 'What do you want to accomplish?' },
} as const;

export function AgentFirstHome({ locale = 'en' as Locale }: { locale?: Locale }) {
  const copy = COPY[locale === 'ar' ? 'ar' : 'en'];
  return (
    <main className="agent-first-home" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="agent-first-nav">
        <Link className="agent-first-brand" to={locale === 'ar' ? '/ar' : '/'} aria-label={copy.title}>{copy.title}</Link>
        <div className="agent-first-nav-actions">
          <Link className="agent-first-tools-button" to={locale === 'ar' ? '/ar/tools' : '/tools'}>{copy.tools}</Link>
          <button type="button" className="agent-first-new-chat" onClick={() => window.location.reload()}>{copy.newChat}</button>
        </div>
      </header>
      <section className="agent-first-main" aria-labelledby="agent-first-title">
        <div className="agent-first-heading">
          <span className="agent-first-mark" aria-hidden="true">✦</span>
          <h1 id="agent-first-title">{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="agent-first-chat"><FlixoAIAgent locale={locale} /></div>
        <p className="agent-first-hint">{locale === 'ar' ? 'اطلب من FLIXO تنفيذ المهمة أو التفكير في أفضل طريقة لإنجازها.' : 'Ask FLIXO to work out the best way to accomplish your task.'}</p>
      </section>
    </main>
  );
}
