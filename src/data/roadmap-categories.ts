import {
  AudioLines,
  Calculator,
  Code2,
  FileCog,
  FileText,
  Globe,
  ImageIcon,
  Languages,
  PenLine,
  Repeat,
  Rocket,
  Sparkles,
  Video,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type RoadmapCategory = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  anchor: string;
  order: number;
};

export const ROADMAP_CATEGORIES: readonly RoadmapCategory[] = Object.freeze([
  { id: 'translation', name: 'Translation Hub', description: 'Text, document, and subtitle translation workflows.', icon: Languages, anchor: 'translation', order: 1 },
  { id: 'images', name: 'Image Tools', description: 'Browser-first image editing and processing.', icon: ImageIcon, anchor: 'images', order: 2 },
  { id: 'pdf', name: 'PDF Tools', description: 'Work with PDF files without leaving the browser.', icon: FileText, anchor: 'pdf', order: 3 },
  { id: 'writing', name: 'AI Writing', description: 'Draft, rewrite, summarize, and polish text.', icon: PenLine, anchor: 'writing', order: 4 },
  { id: 'video', name: 'Video Tools', description: 'Local trimming, cropping, resizing, and compression.', icon: Video, anchor: 'video', order: 5 },
  { id: 'audio', name: 'Audio Tools', description: 'Browser utilities for speech and audio workflows.', icon: AudioLines, anchor: 'audio', order: 6 },
  { id: 'files', name: 'File Tools', description: 'Practical utilities for files, archives, and metadata.', icon: FileCog, anchor: 'files', order: 7 },
  { id: 'utilities', name: 'Utilities', description: 'Small tools for everyday digital tasks.', icon: Wrench, anchor: 'utilities', order: 8 },
  { id: 'converters', name: 'Converters', description: 'Format, encoding, and conversion helpers.', icon: Repeat, anchor: 'converters', order: 9 },
  { id: 'calculators', name: 'Calculators', description: 'Focused calculators for common workflows.', icon: Calculator, anchor: 'calculators', order: 10 },
  { id: 'web', name: 'Web Tools', description: 'URL, metadata, and web diagnostics utilities.', icon: Globe, anchor: 'web', order: 11 },
  { id: 'developer', name: 'Developer Tools', description: 'Formatters, validators, parsers, and coding helpers.', icon: Code2, anchor: 'developer', order: 12 },
  { id: 'ai', name: 'AI Tools', description: 'AI-assisted workflows behind explicit user actions.', icon: Sparkles, anchor: 'ai', order: 13 },
  { id: 'future', name: 'Future Features', description: 'Requested and experimental directions on the roadmap.', icon: Rocket, anchor: 'future', order: 14 },
]);

export const roadmapCategoryById = new Map(
  ROADMAP_CATEGORIES.map((category) => [category.id, category] as const),
);
