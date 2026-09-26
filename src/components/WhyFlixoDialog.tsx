import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { WHY_FLIXO } from '@/data/why-flixo';
import './why-flixo.css';

type LocaleMode = 'ar' | 'en';

export function WhyFlixoDialog({
  locale = 'en',
  open,
  onClose,
}: {
  locale?: LocaleMode;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const copy = WHY_FLIXO[locale === 'ar' ? 'ar' : 'en'];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="why-flixo-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="why-flixo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="why-flixo-title"
        tabIndex={-1}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        lang={locale}
      >
        <header className="why-flixo-header">
          <div>
            <span className="why-flixo-eyebrow">{copy.eyebrow}</span>
            <h2 id="why-flixo-title" className="why-flixo-title">{copy.title}</h2>
            <p className="why-flixo-lead">{copy.lead}</p>
          </div>
          <button type="button" className="why-flixo-close" onClick={onClose} aria-label={copy.close}>
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="why-flixo-body">
          {copy.sections.map((section) => (
            <article key={section.id} className="why-flixo-section">
              <h3>{section.title}</h3>
              {section.body?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && (
                <ul className="why-flixo-list">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
              {section.table && (
                <table className="why-flixo-table">
                  <thead>
                    <tr>{section.table[0].map((cell) => <th key={cell}>{cell}</th>)}</tr>
                  </thead>
                  <tbody>
                    {section.table.slice(1).map((row) => (
                      <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          ))}
        </div>

        <footer className="why-flixo-footer">
          <span className="why-flixo-footer-note">
            {locale === 'ar' ? 'الخصوصية هنا مبدأ هندسي قابل للفحص.' : 'Privacy here is an inspectable engineering principle.'}
          </span>
          <a className="why-flixo-verify" href="https://developer.mozilla.org/en-US/docs/Tools/Network_Monitor" target="_blank" rel="noreferrer">
            {copy.verify}
          </a>
        </footer>
      </section>
    </div>
  );
}
