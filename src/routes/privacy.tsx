import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';

export const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  head: () => ({
    meta: [
      { title: 'Privacy Policy | FLIXO' },
      { name: 'description', content: 'FLIXO privacy information for local browser processing, optional services, analytics, consent, and advertising.' },
      { name: 'robots', content: 'index,follow' },
    ],
  }),
  component: function PrivacyPage() {
    return (
      <main className="tool-page-modern" lang="en">
        <article className="tool-page-modern__body">
          <header className="tool-page-modern__hero">
            <p className="tool-page-modern__eyebrow">FLIXO · PRIVACY</p>
            <h1 className="tool-page-modern__title">Privacy Policy</h1>
            <p className="tool-page-modern__description">FLIXO is designed to keep browser-first processing local where the selected tool supports local processing. This page explains the categories of data that may be processed and the controls available to you.</p>
          </header>
          <section className="tool-page-modern__seo-card"><h2>Local processing</h2><p>Tools marked as local process selected files in the browser. Files are not uploaded by the interface solely because a local tool is opened or used. A tool that requires an external service is expected to disclose that behavior on its own page.</p></section>
          <section className="tool-page-modern__seo-card"><h2>Advertising and consent</h2><p>When advertising is enabled, FLIXO may use Google AdSense and related advertising technology. For users in regions where consent is required, advertising remains disabled until the production consent system reports the required consent. FLIXO does not insert a live publisher identifier into development builds.</p></section>
          <section className="tool-page-modern__seo-card"><h2>Cookies and advertising providers</h2><p>Advertising and consent technologies can use cookies, local storage, or similar identifiers as described by the configured consent provider and advertising partners. The production consent interface is the source for regional choices and vendor controls. See the <a href="/cookies">Cookie Policy</a> for the categories used by the site.</p></section>
          <section className="tool-page-modern__seo-card"><h2>Choices and requests</h2><p>You can refuse optional consent where the consent interface provides that choice, and you can revisit your choices through the site's privacy controls. Requests concerning personal data should be made through the contact channel published by FLIXO in the production deployment.</p></section>
          <p><a href="/terms">Terms of Use</a> · <a href="/cookies">Cookie Policy</a> · <a href="/">FLIXO home</a></p>
        </article>
      </main>
    );
  },
});
