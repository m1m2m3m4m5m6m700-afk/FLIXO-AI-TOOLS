import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';

export const cookiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cookies',
  head: () => ({
    meta: [
      { title: 'Cookie Policy | FLIXO' },
      { name: 'description', content: 'FLIXO information about cookies, local storage, consent technology, and optional advertising.' },
      { name: 'robots', content: 'index,follow' },
    ],
  }),
  component: function CookiesPage() {
    return (
      <main className="tool-page-modern" lang="en">
        <article className="tool-page-modern__body">
          <header className="tool-page-modern__hero">
            <p className="tool-page-modern__eyebrow">FLIXO · COOKIES</p>
            <h1 className="tool-page-modern__title">Cookie Policy</h1>
            <p className="tool-page-modern__description">This page explains the categories of browser storage and consent technology that may be used by FLIXO and its optional partners.</p>
          </header>
          <section className="tool-page-modern__seo-card"><h2>Essential browser storage</h2><p>Some browser storage is required for the application to remember state, complete a tool workflow, or keep the user interface functioning. Local file processing can also use temporary browser memory while a tool is running.</p></section>
          <section className="tool-page-modern__seo-card"><h2>Consent storage</h2><p>When a consent management platform is enabled, it can store a consent string and related preferences so the site can respect the user's choices. The consent platform controls the regional privacy experience and vendor selections.</p></section>
          <section className="tool-page-modern__seo-card"><h2>Advertising storage</h2><p>When Google AdSense is enabled for production, advertising technology may use cookies or similar identifiers according to the configured consent and advertising settings. FLIXO keeps ad serving disabled until the required production controls are available.</p></section>
          <section className="tool-page-modern__seo-card"><h2>Managing choices</h2><p>You can manage optional consent through the site's production privacy controls. Blocking optional storage can change the availability of advertising or other non-essential features while core tool functionality may remain available.</p></section>
          <p><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a> · <a href="/">FLIXO home</a></p>
        </article>
      </main>
    );
  },
});
