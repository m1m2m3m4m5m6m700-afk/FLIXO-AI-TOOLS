import { readFileSync } from 'node:fs';

const seoSource = readFileSync('src/lib/seo/tool-seo.ts', 'utf8');
const pageSource = readFileSync('src/routes/localized-tool-page.tsx', 'utf8');

if (!seoSource.includes("'@type': 'BreadcrumbList'")) throw new Error('BreadcrumbList JSON-LD is missing from tool SEO payload.');
if (!seoSource.includes('itemListElement')) throw new Error('BreadcrumbList itemListElement is missing from tool SEO payload.');
if (!seoSource.includes('getLocalizedToolUrl(locale, tool.id)')) throw new Error('BreadcrumbList does not use the canonical localized tool URL.');
if (!pageSource.includes('seo.structuredData')) throw new Error('Localized tool page is not rendering the SEO structured-data payload.');
if (!pageSource.includes('tool-page-modern__breadcrumbs')) throw new Error('Visible tool breadcrumb navigation is missing.');

console.log('Breadcrumb SEO validation passed: localized BreadcrumbList JSON-LD and visible tool breadcrumbs are wired.');
