import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TOOLS_REGISTRY } from '../config/tools';
import { SmartCommandPalette } from '../components/SmartCommandPalette';
import { getBestToolIntent } from '@/lib/intent-router';
import { loadHomeCopy } from '@/lib/i18n/home-loader';
import { getAuthoritativeToolSeoName } from '@/config/tool-seo-name-resolver';
import { localizeMsUkCategory, localizeMsUkDescription } from '@/lib/i18n/ms-uk-category';
import { LOCALE_METADATA, LOCALES } from '@/lib/i18n';
import { localizeToolCategory, localizeToolDescription } from '@/lib/i18n/tool-localization';
import { IMAGE_BROWSER_FILE_POLICY, validateBrowserFile } from '@/lib/contracts/browser-file-safety';
import type { HomeCopy } from '../data/home-locales';
import type { Locale } from '@/lib/i18n';
import type { ToolDefinition } from '../config/canonical-tool-definition';

type ToolCardProps = { readonly id: string; readonly title: string; readonly description: string; readonly category: 'Images'; readonly categoryLabel: string; readonly path: string };
const READY_TOOLS = TOOLS_REGISTRY.filter((tool) => tool.isReady);
const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', ar: 'العربية', es: 'Español', fr: 'Français', de: 'Deutsch', hi: 'हिन्दी', id: 'Bahasa Indonesia',
  it: 'Italiano', ja: '日本語', ko: '한국어', ms: 'Bahasa Melayu', nl: 'Nederlands', pl: 'Polski', pt: 'Português',
  ru: 'Русский', sv: 'Svenska', th: 'ไทย', tr: 'Türkçe', uk: 'Українська', vi: 'Tiếng Việt',
};

function toLocalizedTool(tool: ToolDefinition, locale: Locale): ToolCardProps {
  const localizedTitle = getAuthoritativeToolSeoName(tool, locale) ?? tool.title;
  const localizedCategory = localizeMsUkCategory(locale, 'Images') ?? localizeToolCategory(locale, 'Images');
  const localizedDescription = localizeMsUkDescription(locale, localizedTitle) ?? localizeToolDescription(locale, localizedTitle, 'Images');
  return { id: tool.id, title: localizedTitle, description: localizedDescription, category: 'Images', categoryLabel: localizedCategory, path: `/${locale}/${tool.id}` };
}

async function recommendTool(file: File, locale: Locale): Promise<ToolCardProps | null> {
  const validation = await validateBrowserFile(file, IMAGE_BROWSER_FILE_POLICY);
  if (!validation.safe) return null;
  const lower = file.name.toLowerCase();
  const imageTool = READY_TOOLS.find((tool) => tool.id === 'image-compressor');
  const ocrTool = READY_TOOLS.find((tool) => tool.id === 'image-ocr');
  const selected = /ocr|text|scan/.test(lower) ? ocrTool ?? imageTool : imageTool;
  return selected ? toLocalizedTool(selected, locale) : null;
}

function renderHeroTitle(value: string) {
  const match = /^([\s\S]*?)<span>([\s\S]*?)<\/span>([\s\S]*)$/.exec(value);
  if (!match) return value;
  return <>{match[1]}<span>{match[2]}</span>{match[3]}</>;
}

export function HomePage({ locale = 'en' as Locale }: { locale?: Locale }) {
  const navigate = useNavigate();
  const [copy, setCopy] = useState<HomeCopy | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dropRecommendation, setDropRecommendation] = useState<ToolCardProps | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void loadHomeCopy(locale).then((nextCopy) => { if (active) setCopy(nextCopy); });
    return () => { active = false; };
  }, [locale]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const localizedTools = useMemo(() => READY_TOOLS.map((tool) => toLocalizedTool(tool, locale)), [locale]);
  const intent = useMemo(() => getBestToolIntent(query, READY_TOOLS), [query]);
  const intentLocalized = intent ? toLocalizedTool(intent.tool, locale) : null;
  const categories = useMemo(() => ['All', 'Images'] as const, []);
  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return localizedTools.filter((tool) => {
      const matchesCategory = selectedCategory === 'All' || selectedCategory === tool.category;
      const haystack = `${tool.id} ${tool.title} ${tool.description} ${tool.categoryLabel}`.toLowerCase();
      return matchesCategory && (!normalized || haystack.includes(normalized));
    });
  }, [localizedTools, query, selectedCategory]);