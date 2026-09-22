import type { ToolCategory } from '../config/canonical-tool-definition';

export type ToolCategoryFilter = 'All' | ToolCategory;

type SearchableTool = {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
};

export function getToolCategories<T extends SearchableTool>(tools: readonly T[]): ToolCategoryFilter[] {
  return ['All', ...Array.from(new Set(tools.map((tool) => tool.category)))];
}

export function filterTools<T extends SearchableTool>(
  tools: readonly T[],
  query: string,
  selectedCategory: ToolCategoryFilter,
): T[] {
  const normalized = query.trim().toLowerCase();
  return tools.filter((tool) => {
    const matchesCategory = selectedCategory === 'All' || selectedCategory === tool.category;
    const haystack = `${tool.id} ${tool.title} ${tool.description}`.toLowerCase();
    return matchesCategory && (!normalized || haystack.includes(normalized));
  });
}
