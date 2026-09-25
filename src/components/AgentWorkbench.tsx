import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { getReadyToolConfigs } from '@/config/tools';
import { getBestToolIntent } from '@/lib/intent-router';
import { addToolToChain, getToolChain } from '@/lib/tool-chain';
import { ToolChainPanel } from './tool-chain-panel';
import './agent-workbench.css';

type Props = { readonly locale?: string };

const copy = (ar: boolean) => ({
  title: 'FLIXO Agent',
  subtitle: ar ? 'وكيل + أدوات في مساحة تنفيذ واحدة' : 'Agent + tools in one execution workspace',
  prompt: ar ? 'ماذا تريد أن تفعل بالصورة؟' : 'What do you want to do with the image?',
  placeholder: ar ? 'مثال: أزل الخلفية وحوّل الصورة إلى WebP' : 'e.g. remove the background and convert to WebP',
  analyze: ar ? 'حلّل الطلب' : 'Analyze task',
  suggested: ar ? 'الأداة المقترحة' : 'Suggested tool',
  use: ar ? 'استخدم الأداة' : 'Use tool',
  chain: ar ? 'أضف إلى سلسلة الأدوات' : 'Add to tool chain',
  tools: ar ? 'الأدوات الجاهزة' : 'Ready tools',
  selected: ar ? 'الأداة النشطة' : 'Active tool',
  open: ar ? 'فتح الأداة' : 'Open tool',
  local: ar ? 'تنفيذ محلي' : 'Local execution',
  file: ar ? 'يمكنك تنفيذ السلسلة على ملفك مباشرة داخل المتصفح.' : 'Run the chain on your file directly in the browser.',
});

export function AgentWorkbench({ locale = 'en' }: Props) {
  const ar = locale === 'ar';
  const t = copy(ar);
  const [query, setQuery] = useState('');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const tools = useMemo(() => getReadyToolConfigs(), []);
  const match = useMemo(() => getBestToolIntent(query, tools), [query, tools]);
  const activeTool = useMemo(() => tools.find((tool) => tool.id === activeToolId) ?? match?.tool ?? null, [activeToolId, match, tools]);
  const visibleTools = useMemo(() => tools.filter((tool) => ['image-compressor', 'image-converter', 'background-remover', 'image-ocr', 'image-upscaler', 'image-cropper'].includes(tool.id)).slice(0, 6), [tools]);
  const chainCount = getToolChain().length;

  const selectTool = (toolId: string) => {
    setActiveToolId(toolId);
    if (!getToolChain().some((step) => step.id === toolId)) addToolToChain(toolId);
  };

  return (
    <section className="agent-workbench" aria-labelledby="agent-workbench-title">
      <div className="agent-workbench__header">
        <div><span className="image-tool-eyebrow">AGENT WORKSPACE</span><h2 id="agent-workbench-title">{t.title}</h2><p>{t.subtitle}</p></div>
        <span className="agent-workbench__status"><span />READY</span>
      </div>
      <div className="agent-workbench__grid">
        <div className="agent-workbench__chat">
          <div className="agent-workbench__message agent-workbench__message--agent"><strong>{t.title}</strong><span>{t.subtitle}</span></div>
          <label className="sr-only" htmlFor="flixo-agent-prompt">{t.prompt}</label>
          <textarea id="flixo-agent-prompt" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder} rows={3} />
          <div className="agent-workbench__prompt-actions"><span>{t.local}</span><button type="button" onClick={() => setQuery((value) => value.trim())} disabled={!query.trim()}>{t.analyze}</button></div>
          {match && <div className="agent-workbench__result"><div><span>{t.suggested}</span><strong>{match.tool.title}</strong><small>{match.tool.description}</small></div><div className="agent-workbench__result-actions"><button type="button" onClick={() => selectTool(match.tool.id)}>{t.chain}</button><Link to={match.tool.path}>{t.open}</Link></div></div>}
          {activeTool && <div className="agent-workbench__active"><span>{t.selected}</span><strong>{activeTool.title}</strong><small>{t.file} {chainCount ? '(' + chainCount + '/8)' : ''}</small></div>}
        </div>
        <aside className="agent-workbench__tools" aria-label={t.tools}>
          <div className="agent-workbench__tools-head"><strong>{t.tools}</strong><span>{tools.length}</span></div>
          <div className="agent-workbench__tool-list">
            {visibleTools.map((tool) => <button type="button" key={tool.id} className={activeTool?.id === tool.id ? 'is-active' : ''} onClick={() => selectTool(tool.id)}><span>{tool.title}</span><small>{tool.category}</small></button>)}
          </div>
        </aside>
      </div>
      <ToolChainPanel currentToolId={activeTool?.id ?? null} />
    </section>
  );
}
