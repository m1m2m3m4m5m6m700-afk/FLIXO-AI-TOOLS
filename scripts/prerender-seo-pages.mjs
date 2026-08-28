import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.cwd());
const dist = join(root, 'dist');
const indexPath = join(dist, 'index.html');
if (!existsSync(indexPath)) throw new Error('dist/index.html is missing; run vite build first');

const importTs = async (file) => import(pathToFileURL(join(root, file)).href);
const { LOCALES, LOCALE_METADATA, getCanonicalSiteOrigin } = await importTs('src/lib/i18n/config.ts');
const SITE_ORIGIN = getCanonicalSiteOrigin();
const { TOOL_SEO_MANIFESTS } = await importTs('src/lib/seo/tool-manifests.ts');
const { TOOL_MANIFEST } = await importTs('src/config/tool-manifest.ts');
const { getToolSeo } = await importTs('src/lib/seo/tool-seo.ts');
const { getToolRelations } = await importTs('src/config/tool-relations.ts');

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
const escapeJsonLd = (value) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
const localizedUrl = (locale, slug) => `${SITE_ORIGIN}/${locale}/${slug}`;
const manifestById = new Map(TOOL_MANIFEST.map((tool) => [tool.id, tool]));
const readyToolIds = new Set(TOOL_MANIFEST.filter((tool) => tool.isReady !== false).map((tool) => tool.id));

const shell = readFileSync(indexPath, 'utf8');
const headEnd = shell.indexOf('</head>');
const rootStart = shell.indexOf('<div id="root">');
const rootEnd = shell.indexOf('</div>', rootStart);
if (headEnd < 0 || rootStart < 0 || rootEnd < 0) throw new Error('Unexpected Vite HTML shell structure');

const baseHead = shell
  .slice(0, headEnd)
  .replace(/<html\b[^>]*>/iu, '<html>')
  .replace(/<title>[\s\S]*?<\/title>\s*/iu, '')
  .replace(/<meta\s+name="description"[^>]*>\s*/iu, '');
const bodyEnd = shell.slice(rootEnd + '</div>'.length);

const localeHeading = {
  en: ['How to use', 'What you can do', 'Capabilities', 'Related tools'], ar: ['طريقة الاستخدام', 'ماذا يمكنك أن تفعل', 'القدرات', 'أدوات ذات صلة'], es: ['Cómo usar', 'Qué puedes hacer', 'Capacidades', 'Herramientas relacionadas'],
  fr: ['Comment utiliser', 'Ce que vous pouvez faire', 'Capacités', 'Outils associés'], de: ['So verwenden Sie es', 'Was Sie tun können', 'Funktionen', 'Ähnliche Tools'], ru: ['Как использовать', 'Что можно сделать', 'Возможности', 'Похожие инструменты'],
  zh: ['使用方法', '你可以做什么', '功能', '相关工具'], hi: ['कैसे उपयोग करें', 'आप क्या कर सकते हैं', 'क्षमताएँ', 'संबंधित टूल'], id: ['Cara menggunakan', 'Yang dapat Anda lakukan', 'Kemampuan', 'Alat terkait'], ur: ['استعمال کا طریقہ', 'آپ کیا کر سکتے ہیں', 'صلاحیتیں', 'متعلقہ ٹولز'],
  ja: ['使い方', 'できること', '機能', '関連ツール'], pt: ['Como usar', 'O que você pode fazer', 'Recursos', 'Ferramentas relacionadas'], it: ['Come usarlo', 'Cosa puoi fare', 'Funzionalità', 'Strumenti correlati'], ko: ['사용 방법', '할 수 있는 작업', '기능', '관련 도구'],
  nl: ['Zo gebruik je het', 'Wat je kunt doen', 'Mogelijkheden', 'Gerelateerde tools'], pl: ['Jak używać', 'Co możesz zrobić', 'Możliwości', 'Powiązane narzędzia'], tr: ['Nasıl kullanılır', 'Neler yapabilirsiniz', 'Yetenekler', 'İlgili araçlar'],
  vi: ['Cách sử dụng', 'Bạn có thể làm gì', 'Khả năng', 'Công cụ liên quan'], th: ['วิธีใช้งาน', 'สิ่งที่ทำได้', 'ความสามารถ', 'เครื่องมือที่เกี่ยวข้อง'], sv: ['Så använder du verktyget', 'Det här kan du göra', 'Funktioner', 'Relaterade verktyg'],
};

const rendered = [];
for (const toolManifest of TOOL_SEO_MANIFESTS) {
  if (!readyToolIds.has(toolManifest.toolId)) continue;
  const tool = manifestById.get(toolManifest.toolId);
  if (!tool) continue;
  const relations = getToolRelations(tool);
  const relationIds = [...relations.relatedToolIds, ...relations.prerequisiteToolIds];
  const related = relationIds
    .map((id) => manifestById.get(id))
    .filter((candidate) => Boolean(candidate?.isReady))
    .filter((candidate, index, values) => values.findIndex((item) => item?.id === candidate?.id) === index)
    .slice(0, 6);
  const fallbackRelated = TOOL_MANIFEST
    .filter((candidate) => candidate.isReady !== false && candidate.id !== tool.id && candidate.category === tool.category)
    .filter((candidate) => !related.some((item) => item.id === candidate.id))
    .slice(0, Math.max(0, 4 - related.length));
  const relatedTools = [...related, ...fallbackRelated].slice(0, 6);

  for (const locale of LOCALES) {
    const manifestSeo = toolManifest.seoLocales?.[locale];
    if (!manifestSeo) throw new Error(`Missing SEO payload for ${toolManifest.toolId}:${locale}`);
    const runtimeSeo = getToolSeo(locale, tool.id);
    if (!runtimeSeo) throw new Error(`Missing runtime SEO contract for ${tool.id}:${locale}`);
    const meta = LOCALE_METADATA[locale];
    const url = localizedUrl(locale, toolManifest.slug);
    const title = runtimeSeo.title;
    const description = runtimeSeo.description;
    const headings = localeHeading[locale];
    const steps = manifestSeo.howTo.slice(0, 6);
    const features = manifestSeo.features.slice(0, 8);
    const capabilities = (toolManifest.capabilities ?? []).filter(Boolean).slice(0, 8);

    const alternateLinks = LOCALES.map((candidate) => `<link rel="alternate" hreflang="${escapeHtml(LOCALE_METADATA[candidate].languageTag)}" href="${escapeHtml(localizedUrl(candidate, toolManifest.slug))}" />`).join('');
    const xDefault = `<link rel="alternate" hreflang="x-default" href="${escapeHtml(localizedUrl('en', toolManifest.slug))}" />`;
    const canonical = `<link rel="canonical" href="${escapeHtml(url)}" />`;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: meta.languageTag },
        { '@type': 'SoftwareApplication', '@id': `${url}#application`, name: title.replace(/\s*\|\s*FLIXO$/u, ''), applicationCategory: 'UtilitiesApplication', operatingSystem: 'Web Browser', description, url, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'FLIXO', item: localizedUrl(locale, '') },
          { '@type': 'ListItem', position: 2, name: title.replace(/\s*\|\s*FLIXO$/u, ''), item: url },
        ] },
      ],
    };

    const relatedHtml = relatedTools.map((candidate) => {
      const relatedManifest = TOOL_SEO_MANIFESTS.find((item) => item.toolId === candidate.id);
      const relatedTitle = relatedManifest?.seoLocales?.[locale]?.title ?? `${candidate.title} | FLIXO`;
      return `<li><a href="/${escapeHtml(locale)}/${escapeHtml(candidate.id)}">${escapeHtml(relatedTitle.replace(/\s*\|\s*FLIXO$/u, ''))}</a></li>`;
    }).join('');
    const stepsHtml = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
    const featuresHtml = features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('');
    const capabilitiesHtml = (capabilities.length ? capabilities : features).map((capability) => `<li>${escapeHtml(capability)}</li>`).join('');

    const localizedHead = baseHead.replace('<html>', `<html lang="${escapeHtml(meta.languageTag)}" dir="${escapeHtml(meta.direction)}">`);
    const routeHtml = `${localizedHead}
      <meta name="description" content="${escapeHtml(description)}" />
      <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content="${escapeHtml(title)}" />
      <meta property="og:description" content="${escapeHtml(description)}" />
      <meta property="og:url" content="${escapeHtml(url)}" />
      <meta property="og:image" content="${escapeHtml(`${SITE_ORIGIN}/flixo-logo.svg`)}" />
      <meta name="twitter:card" content="summary_large_image" />
      <title>${escapeHtml(title)}</title>
      ${canonical}${alternateLinks}${xDefault}
      <script type="application/ld+json">${escapeJsonLd(jsonLd)}</script>
    </head>
    <body>
      <div id="root">
        <main lang="${escapeHtml(meta.languageTag)}" dir="${escapeHtml(meta.direction)}" data-flixo-prerendered="true">
          <article class="seo-prerender-content">
            <header>
              <p>${escapeHtml(tool.category)} · FLIXO</p>
              <h1>${escapeHtml(title.replace(/\s*\|\s*FLIXO$/u, ''))}</h1>
              <p>${escapeHtml(description)}</p>
              <p>${escapeHtml(manifestSeo.intro)}</p>
            </header>
            <section aria-labelledby="how-to"><h2 id="how-to">${escapeHtml(headings[0])}</h2><ol>${stepsHtml}</ol></section>
            <section aria-labelledby="features"><h2 id="features">${escapeHtml(headings[1])}</h2><ul>${featuresHtml}</ul></section>
            <section aria-labelledby="capabilities"><h2 id="capabilities">${escapeHtml(headings[2])}</h2><ul>${capabilitiesHtml}</ul></section>
            <section aria-labelledby="related"><h2 id="related">${escapeHtml(headings[3])}</h2><ul>${relatedHtml}</ul></section>
            <p><a href="/${escapeHtml(locale)}">FLIXO</a></p>
          </article>
        </main>
      </div>${bodyEnd}`;

    const output = join(dist, locale, toolManifest.slug, 'index.html');
    mkdirSync(join(dist, locale, toolManifest.slug), { recursive: true });
    writeFileSync(output, routeHtml, 'utf8');
    rendered.push(`/${locale}/${toolManifest.slug}`);
  }
}

const uniqueRoutes = new Set(rendered);
console.log(`SEO PRERENDER PASS: ${uniqueRoutes.size} localized tool HTML pages emitted from the canonical SEO manifest.`);
if (uniqueRoutes.size !== readyToolIds.size * LOCALES.length) {
  throw new Error(`Prerender coverage mismatch: expected ${readyToolIds.size * LOCALES.length}, got ${uniqueRoutes.size}`);
}