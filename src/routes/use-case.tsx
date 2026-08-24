import { createRoute } from '@tanstack/react-router';
import { getToolConfig } from '../config/tools';
import { getUseCase } from '../lib/seo/use-cases';
import { rootRoute } from './__root';

export const useCaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/use-cases/$slug',
  head: ({ params }) => {
    const useCase = getUseCase(params.slug);
    if (!useCase) return { meta: [{ title: 'FLIXO | Use case not found' }, { name: 'robots', content: 'noindex,nofollow' }] };
    return {
      meta: [
        { title: `${useCase.title} | FLIXO` },
        { name: 'description', content: useCase.description },
        { name: 'robots', content: 'index,follow,max-image-preview:large' },
        { property: 'og:title', content: `${useCase.title} | FLIXO` },
        { property: 'og:description', content: useCase.description },
      ],
    };
  },
  component: function UseCasePage() {
    const { slug } = useCaseRoute.useParams();
    const useCase = getUseCase(slug);

    if (!useCase) return <main><h1>Use case not found</h1></main>;

    const tools = useCase.toolIds
      .map((toolId) => getToolConfig(toolId))
      .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool?.isReady));

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: useCase.title,
      description: useCase.description,
      url: `/use-cases/${useCase.slug}`,
      isPartOf: { '@type': 'WebSite', name: 'FLIXO', url: '/' },
      mainEntity: {
        '@type': 'FAQPage',
        mainEntity: useCase.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    };

    return (
      <main className="tool-page-modern" lang="en">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
        <div className="tool-page-modern__body">
          <nav className="tool-page-modern__breadcrumbs" aria-label="Breadcrumb">
            <a className="tool-page-modern__crumb" href="/">FLIXO</a>
            <span className="tool-page-modern__crumb-sep">/</span>
            <span className="tool-page-modern__crumb" aria-current="page">Use cases</span>
          </nav>
          <header className="tool-page-modern__hero">
            <p className="tool-page-modern__eyebrow">FLIXO · USE CASE</p>
            <h1 className="tool-page-modern__title">{useCase.title}</h1>
            <p className="tool-page-modern__description">{useCase.description}</p>
          </header>
          <section className="tool-page-modern__seo" aria-label="Recommended tools">
            {tools.map((tool) => (
              <article className="tool-page-modern__seo-card" key={tool.id}>
                <h2>{tool.title}</h2>
                <p>{tool.description}</p>
                <a href={`/en/${tool.id}`}>Open tool →</a>
              </article>
            ))}
          </section>
          <section className="tool-page-modern__seo" aria-label="Frequently asked questions">
            <article className="tool-page-modern__seo-card">
              <h2>Frequently asked questions</h2>
              {useCase.faq.map((item) => (
                <div key={item.question}>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </div>
              ))}
            </article>
          </section>
        </div>
      </main>
    );
  },
});
