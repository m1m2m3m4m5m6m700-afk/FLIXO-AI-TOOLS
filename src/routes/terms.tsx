import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';

export const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  head: () => ({
    meta: [
      { title: 'Terms of Use | FLIXO' },
      { name: 'description', content: 'Terms governing use of FLIXO browser-first productivity tools and generated outputs.' },
      { name: 'robots', content: 'index,follow' },
    ],
  }),
  component: function TermsPage() {
    return (
      <main className="tool-page-modern" lang="en">
        <article className="tool-page-modern__body">
          <header className="tool-page-modern__hero">
            <p className="tool-page-modern__eyebrow">FLIXO · TERMS</p>
            <h1 className="tool-page-modern__title">Terms of Use</h1>
            <p className="tool-page-modern__description">Use FLIXO responsibly and only for lawful purposes. Tools are provided to help users transform, inspect, or generate files and text according to the behavior documented on each tool page.</p>
          </header>
          <section className="tool-page-modern__seo-card"><h2>Tool behavior</h2><p>Before processing important files, review the tool description, supported inputs, output format, and any limitations shown in the interface. Browser-first processing does not imply that every tool works identically or that every browser feature is supported on every device.</p></section>
          <section className="tool-page-modern__seo-card"><h2>Generated outputs</h2><p>You are responsible for checking the result before publishing, sharing, or relying on it. FLIXO does not promise that a generated or transformed file is error-free, suitable for a particular professional purpose, or compliant with a third-party specification.</p></section>
          <section className="tool-page-modern__seo-card"><h2>Availability and changes</h2><p>Features can change as tools are improved, retired, or moved between local and service-backed implementations. Security, privacy, and quality safeguards may prevent processing in cases that are unsupported or unsafe.</p></section>
          <p><a href="/privacy">Privacy Policy</a> · <a href="/cookies">Cookie Policy</a> · <a href="/">FLIXO home</a></p>
        </article>
      </main>
    );
  },
});
