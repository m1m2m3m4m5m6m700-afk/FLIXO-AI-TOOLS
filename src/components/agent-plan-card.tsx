import type { VisualTaskSpec } from '@/lib/contracts/visual-task-spec';
import './agent-plan-card.css';

type Props = Readonly<{
  spec: VisualTaskSpec | null;
  locale?: string;
}>;

export function AgentPlanCard({ spec, locale = 'en' }: Props) {
  if (!spec) return null;
  const ar = locale === 'ar';
  return (
    <section className="flixo-agent-plan-card" data-testid="flixo-agent-visual-plan" aria-label={ar ? 'خطة FLIXO' : 'FLIXO plan'}>
      <div className="flixo-agent-plan-card__head">
        <div>
          <span>{ar ? 'الخطة البصرية' : 'VISUAL PLAN'}</span>
          <strong>{ar ? 'فهم → تنفيذ → تحقق → مراجعة' : 'Understand → Execute → Verify → Review'}</strong>
        </div>
        <small>{spec.operations.length} {ar ? 'خطوات' : 'steps'}</small>
      </div>
      <ol>
        {spec.operations.map((operation) => (
          <li key={operation.id}>
            <span>{operation.order}</span>
            <div><strong>{operation.capabilityId}</strong><small>{operation.purpose}</small></div>
          </li>
        ))}
      </ol>
      {spec.constraints.length > 0 && (
        <div className="flixo-agent-plan-card__constraints">
          <span>{ar ? 'القيود' : 'Constraints'}</span>
          {spec.constraints.map((constraint) => <small key={constraint.id}>{constraint.value}</small>)}
        </div>
      )}
    </section>
  );
}
