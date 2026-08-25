type SearchableTool = {
  id: string;
  title: string;
  description: string;
  category: string;
};

export function getToolCategories<T extends SearchableTool>(tools: readonly T[]): string[] {
  return ['All', ...Array.from(new Set(tools.map((tool) => tool.category)))];
}

export function filterTools<T extends SearchableTool>(
  tools: readonly T[],
  query: string,
  selectedCategory: string,
): T[] {
  const normalized = query.trim().toLowerCase();
  return tools.filter((tool) => {
    const matchesCategory = selectedCategory === 'All' || selectedCategory === tool.category;
    const haystack = `${tool.id} ${tool.title} ${tool.description}`.toLowerCase();
    return matchesCategory && (!normalized || haystack.includes(normalized));
  });
}
