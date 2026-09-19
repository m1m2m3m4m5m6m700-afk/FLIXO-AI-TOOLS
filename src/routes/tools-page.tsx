import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { TOOLS_REGISTRY } from '@/config/tools';
import { getAuthoritativeToolSeoName } from '@/config/tool-seo-name-resolver';
import { localizeToolDescription } from '@/lib/i18n/tool-localization';
import type { Locale } from '@/lib/i18n';
import './tools-modern.css';

export function ToolsPage({ locale = 'en' as Locale }: { locale?: Locale }) {
  const [query,setQuery]=useState('');
  const ready=useMemo(()=>TOOLS_REGISTRY.filter(t=>t.isReady),[]);
  const tools=useMemo(()=>ready.map(tool=>{const title=getAuthoritativeToolSeoName(tool,locale) ?? tool.title;return {...tool,title,description:localizeToolDescription(locale,title,tool.category),path:tool.path.replace(/^\/en\//,locale==='ar'?'/ar/':'/en/')}}).filter(tool=>{const haystack=(tool.id+' '+tool.title+' '+tool.description).toLowerCase();return !query.trim()||haystack.includes(query.trim().toLowerCase());}),[ready,locale,query]);
  const ar=locale==='ar';
  return <main className="tools-modern" lang={locale} dir={ar?'rtl':'ltr'}>
    <header className="tools-modern-nav"><Link className="tools-modern-brand" to={ar?'/ar':'/'}>FLIXO</Link><Link className="tools-modern-back" to={ar?'/ar':'/'}>← {ar?'العودة إلى FLIXO':'Back to FLIXO'}</Link></header>
    <div className="tools-modern-container">
      <section className="tools-modern-hero"><span>{ar?'FLIXO · تعديل الصور':'FLIXO · IMAGE EDITING'}</span><h1>{ar?'أدوات تعديل الصور':'Image editing tools'}</h1><p>{ar?'استخدم قدرات FLIXO يدويًا عندما تريد تحكمًا مباشرًا.':'Use FLIXO capabilities manually when you want direct control.'}</p><input aria-label={ar?'البحث عن أداة':'Search image tools'} value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'ابحث عن أداة لتعديل الصورة…':'Search image editing tools…'}/></section>
      <section className="tools-modern-grid" aria-label={ar?'أدوات تعديل الصور':'Image editing tools'}>{tools.map(tool=><Link key={tool.id} to={tool.path} className="tools-modern-card"><div className="tools-modern-card-top"><span>{ar?'تعديل الصور':'Image editing'}</span><b>↗</b></div><h2>{tool.title}</h2><p>{tool.description}</p><small>{ar?'فتح الأداة':'Open tool'}</small></Link>)}</section>
      {tools.length===0&&<div className="tools-modern-empty">{ar?'لا توجد أدوات مطابقة.':'No matching image tools.'}</div>}
    </div>
  </main>;
}
