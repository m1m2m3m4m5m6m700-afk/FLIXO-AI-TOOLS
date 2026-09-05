import { Link } from '@tanstack/react-router';
import { HOME_AR } from '../data/home-i18n';

type ToolCard = {
  title: string;
  description: string;
  category: 'Images' | 'AI' | 'Other';
  path: string;
};

type Props = {
  categories: string[];
  filteredTools: ToolCard[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
};

const AR_CATEGORY: Record<ToolCard['category'], string> = {
  Images: 'الصور',
  AI: 'الذكاء الاصطناعي',
  Other: 'أخرى',
};

export function ArHomeToolsSection({ categories, filteredTools, selectedCategory, onSelectCategory }: Props) {
  return (
    <section id="tools" className="home-tools-section" aria-labelledby="tools-title">
      <div className="section-heading">
        <div>
          <span className="image-tool-eyebrow">{HOME_AR.toolbox}</span>
          <h2 id="tools-title">{HOME_AR.toolboxTitle}</h2>
        </div>
        <span className="tool-count">{filteredTools.length} {HOME_AR.ready}</span>
      </div>
      <div id="categories" className="category-pills" aria-label={HOME_AR.ariaCategories}>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={selectedCategory === category ? 'is-active' : ''}
            onClick={() => onSelectCategory(category)}
          >
            {category === 'All' ? HOME_AR.all : AR_CATEGORY[category as ToolCard['category']]}
          </button>
        ))}
      </div>
      <div className="home-tools-grid">
        {filteredTools.map((tool) => (
          <Link key={tool.path} to={tool.path} className="home-tool-card" aria-label={`${HOME_AR.openTool} ${tool.title}`}>
            <div className="tool-card-topline">
              <span className="tool-card-category">{AR_CATEGORY[tool.category]}</span>
              <span className="tool-card-arrow" aria-hidden="true">↗</span>
            </div>
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            <span className="tool-card-meta">{HOME_AR.browserMeta}</span>
          </Link>
        ))}
      </div>
      {filteredTools.length === 0 && <div className="home-empty">{HOME_AR.empty}</div>}
    </section>
  );
}
