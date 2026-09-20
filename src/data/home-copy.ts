import type { Locale } from '@/lib/i18n';

export type HomeCopy = Readonly<{
  language: Locale;
  dir: 'ltr' | 'rtl';
  nav: { tools: string; categories: string; privacy: string; switch: string };
  badge: string; eyebrow: string; heroTitle: string; heroLead: string;
  describe: string; searchLabel: string; searchPlaceholder: string; smartPalette: string;
  suggested: string; openDirectly: string; popular: string;
  trust: readonly [string, string][];
  quickDrop: string; quickDropTitle: string; quickDropLead: string; dropChoose: string; dropSupport: string;
  suggestedTool: string; openTool: string; toolbox: string; toolboxTitle: string; ready: string; empty: string;
  builtForFocus: string; finalTitle: string; finalLead: string; trySmart: string; all: string; browserMeta: string;
  ariaHome: string; ariaPrimary: string; ariaFindTool: string; ariaTrust: string; ariaCategories: string;
  quickTags: readonly string[];
}>;
