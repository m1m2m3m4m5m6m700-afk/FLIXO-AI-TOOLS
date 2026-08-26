import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { BarChart3, ClipboardList, Download, FileText, LogOut, Plus, Shield, Trash2, Users } from 'lucide-react';
import {
  audit,
  createQuestion,
  createSurvey,
  downloadResponsesCsv,
  getAuditEvents,
  getResponses,
  getSurveys,
  saveSurveys,
  type AdminAuditEvent,
  type Survey,
  type SurveyQuestion,
  type SurveyQuestionType,
  type SurveyResponse,
} from '@/lib/admin-surveys';
import { getAdminSessionStatus, logoutAdmin } from '@/lib/admin/auth';
import './admin.css';

export const Route = createFileRoute('/admin')({
  head: () => ({ meta: [{ title: 'FLIXO Admin Control Center' }, { name: 'robots', content: 'noindex, nofollow, noarchive' }] }),
  beforeLoad: async () => {
    const session = await getAdminSessionStatus();
    if (!session.authenticated) throw redirect({ to: '/admin-login' });
    return { adminRole: session.role };
  },
  component: AdminPage,
});

type AdminTab = 'overview' | 'surveys' | 'responses' | 'roles' | 'audit' | 'settings';
const tabs: Array<{ id: AdminTab; label: string; icon: typeof BarChart3 }> = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'surveys', label: 'Surveys', icon: ClipboardList },
  { id: 'responses', label: 'Responses', icon: FileText },
  { id: 'roles', label: 'Roles', icon: Users },
  { id: 'audit', label: 'Audit log', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Shield },
];
const questionTypes: Array<{ value: SurveyQuestionType; label: string }> = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'rating', label: 'Rating 1–5' },
  { value: 'select', label: 'Single choice' },
  { value: 'multiselect', label: 'Multiple choice' },
  { value: 'boolean', label: 'Yes / No' },
];

function AdminPage() {
  const routeContext = Route.useRouteContext();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [surveys, setSurveys] = useState<Survey[]>(() => getSurveys());
  const [responses] = useState<SurveyResponse[]>(() => getResponses());
  const [auditEvents, setAuditEvents] = useState<AdminAuditEvent[]>(() => getAuditEvents());
  const [selectedId, setSelectedId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [questionLabel, setQuestionLabel] = useState('');
  const [questionType, setQuestionType] = useState<SurveyQuestionType>('text');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedSurvey = surveys.find((survey) => survey.id === selectedId) ?? surveys[0];
  const filteredSurveys = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? surveys.filter((survey) => `${survey.title} ${survey.description}`.toLowerCase().includes(q)) : surveys;
  }, [search, surveys]);
  const stats = {
    total: surveys.length,
    active: surveys.filter((survey) => survey.status === 'active').length,
    questions: surveys.reduce((count, survey) => count + survey.questions.length, 0),
    responses: responses.length,
  };

  const persist = (next: Survey[], message: string, action: string, target: string) => {
    saveSurveys(next);
    setSurveys(next);
    audit(action, target);
    setAuditEvents(getAuditEvents());
    setNotice(message);
  };
  const addSurvey = () => {
    const survey = createSurvey(newTitle, newDescription);
    persist([survey, ...surveys], 'Survey created', 'create_survey', survey.title);
    setSelectedId(survey.id);
    setNewTitle('');
    setNewDescription('');
  };
  const updateSurvey = (patch: Partial<Survey>) => {
    if (!selectedSurvey) return;
    const next = surveys.map((survey) => survey.id === selectedSurvey.id ? { ...survey, ...patch, updatedAt: new Date().toISOString() } : survey);
    persist(next, 'Survey saved', 'update_survey', selectedSurvey.title);
  };
  const deleteSurvey = (survey: Survey) => {
    const next = surveys.filter((item) => item.id !== survey.id);
    persist(next, 'Survey deleted', 'delete_survey', survey.title);
    setSelectedId(next[0]?.id ?? '');
  };
  const addQuestion = () => {
    if (!selectedSurvey || !questionLabel.trim()) return;
    const question = createQuestion(questionLabel, questionType);
    const next = surveys.map((survey) => survey.id === selectedSurvey.id ? { ...survey, questions: [...survey.questions, question], updatedAt: new Date().toISOString() } : survey);
    persist(next, 'Question added', 'add_question', question.label);
    setQuestionLabel('');
  };
  const updateQuestion = (questionId: string, patch: Partial<SurveyQuestion>) => {
    if (!selectedSurvey) return;
    const next = surveys.map((survey) => survey.id === selectedSurvey.id
      ? { ...survey, questions: survey.questions.map((question) => question.id === questionId ? { ...question, ...patch } : question), updatedAt: new Date().toISOString() }
      : survey);
    persist(next, 'Question updated', 'update_question', selectedSurvey.title);
  };
  const deleteQuestion = (questionId: string) => {
    if (!selectedSurvey) return;
    const next = surveys.map((survey) => survey.id === selectedSurvey.id
      ? { ...survey, questions: survey.questions.filter((question) => question.id !== questionId), updatedAt: new Date().toISOString() }
      : survey);
    persist(next, 'Question deleted', 'delete_question', selectedSurvey.title);
  };
  const signOut = async () => {
    setBusy(true);
    try {
      await logoutAdmin();
      window.location.assign('/admin-login');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><div className="admin-mark">F</div><div><strong>FLIXO</strong><span>Admin Control Center</span></div></div>
        <nav aria-label="Admin navigation">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={tab === id ? 'admin-nav-item active' : 'admin-nav-item'} onClick={() => setTab(id)}><Icon size={17} />{label}</button>)}</nav>
        <div className="admin-security-card"><Shield size={18} /><strong>Authenticated</strong><span>Role: {routeContext.adminRole ?? 'owner'}. Admin actions are restricted to the authenticated session.</span><button type="button" className="admin-secondary" disabled={busy} onClick={signOut}><LogOut size={15} />Sign out</button></div>
      </aside>
      <section className="admin-main">
        <header className="admin-topbar"><div><span className="admin-eyebrow">CONTROL CENTER</span><h1>FLIXO administration</h1></div><div className="admin-local-badge">Protected</div></header>
        {notice && <div className="admin-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')}>Dismiss</button></div>}
        {tab === 'overview' && <section className="admin-content"><div className="admin-grid admin-grid-4"><StatCard label="Surveys" value={stats.total} icon={<ClipboardList size={18} />} /><StatCard label="Active" value={stats.active} icon={<BarChart3 size={18} />} /><StatCard label="Questions" value={stats.questions} icon={<FileText size={18} />} /><StatCard label="Responses" value={stats.responses} icon={<Users size={18} />} /></div><div className="admin-grid admin-grid-2"><Panel title="Survey coverage" subtitle="Every questionnaire is modeled explicitly; no fake response counts are injected."><div className="admin-bars">{surveys.map((survey) => <div key={survey.id} className="admin-bar-row"><span>{survey.title}</span><div><i style={{ width: `${Math.max(6, Math.min(100, survey.questions.length * 16))}%` }} /></div><strong>{survey.questions.length}</strong></div>)}</div></Panel><Panel title="Recent admin activity" subtitle="Local audit log for create/update/delete operations."><div className="admin-list">{auditEvents.slice(0, 6).map((event) => <div key={event.id}><strong>{event.action}</strong><span>{event.target}</span><time>{new Date(event.at).toLocaleString()}</time></div>)}{auditEvents.length === 0 && <EmptyState text="No administrative actions yet." />}</div></Panel></div></section>}
        {tab === 'surveys' && <section className="admin-content"><div className="admin-grid admin-grid-surveys"><Panel title="All surveys" subtitle="Create, activate, archive and select a questionnaire."><div className="admin-toolbar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search surveys…" aria-label="Search surveys" /><button type="button" className="admin-primary" onClick={addSurvey}><Plus size={16} />Create</button></div><div className="admin-list">{filteredSurveys.map((survey) => <button key={survey.id} type="button" className={selectedSurvey?.id === survey.id ? 'admin-survey-row selected' : 'admin-survey-row'} onClick={() => setSelectedId(survey.id)}><span><strong>{survey.title}</strong><small>{survey.description}</small></span><em className={`status-${survey.status}`}>{survey.status}</em></button>)}{filteredSurveys.length === 0 && <EmptyState text="No surveys match your search." />}</div><div className="admin-create-box"><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="New survey title" /><textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Purpose and audience" rows={3} /><button type="button" className="admin-secondary" onClick={addSurvey}>Add survey</button></div></Panel><Panel title={selectedSurvey?.title ?? 'Survey builder'} subtitle={selectedSurvey?.description ?? 'Select or create a survey to begin.'}>{selectedSurvey ? <><div className="admin-form-grid"><label>Status<select value={selectedSurvey.status} onChange={(event) => updateSurvey({ status: event.target.value as Survey['status'] })}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label><label>Audience<select value={selectedSurvey.audience} onChange={(event) => updateSurvey({ audience: event.target.value as Survey['audience'] })}><option value="all">Everyone</option><option value="signed-in">Signed-in</option><option value="tool-users">Tool users</option></select></label></div><div className="admin-section-heading"><div><strong>Questions</strong><span>{selectedSurvey.questions.length} configured</span></div><button type="button" className="admin-danger-ghost" onClick={() => deleteSurvey(selectedSurvey)}><Trash2 size={15} />Delete survey</button></div><div className="admin-question-list">{selectedSurvey.questions.map((question, index) => <div key={question.id} className="admin-question"><div className="admin-question-index">{index + 1}</div><div className="admin-question-fields"><input value={question.label} onChange={(event) => updateQuestion(question.id, { label: event.target.value })} aria-label={`Question ${index + 1}`} /><div className="admin-form-grid"><label>Type<select value={question.type} onChange={(event) => updateQuestion(question.id, { type: event.target.value as SurveyQuestionType })}>{questionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="admin-checkbox"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} />Required</label></div></div><button type="button" className="admin-icon-button" onClick={() => deleteQuestion(question.id)} aria-label={`Delete question ${index + 1}`}><Trash2 size={15} /></button></div>)}</div><div className="admin-add-question"><input value={questionLabel} onChange={(event) => setQuestionLabel(event.target.value)} placeholder="Question text" /><select value={questionType} onChange={(event) => setQuestionType(event.target.value as SurveyQuestionType)}>{questionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><button type="button" className="admin-primary" onClick={addQuestion}><Plus size={16} />Add question</button></div></> : <EmptyState text="Create your first survey to start building questions." />}</Panel></div></section>}
        {tab === 'responses' && <section className="admin-content"><Panel title="Survey responses" subtitle="Real responses only. Empty storage means zero responses."><div className="admin-toolbar"><span className="admin-muted">{responses.length} responses</span><button type="button" className="admin-secondary" disabled={responses.length === 0} onClick={() => downloadResponsesCsv(new Map(surveys.map((survey) => [survey.id, survey])), responses)}><Download size={16} />Export CSV</button></div><div className="admin-response-table"><div className="admin-response-head"><span>Submitted</span><span>Survey</span><span>Locale</span><span>Answers</span></div>{responses.map((response) => <div key={response.id} className="admin-response-row"><time>{new Date(response.submittedAt).toLocaleString()}</time><strong>{surveys.find((survey) => survey.id === response.surveyId)?.title ?? response.surveyId}</strong><span>{response.locale ?? '—'}</span><span>{Object.entries(response.answers).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value ?? '')}`).join(' · ')}</span></div>)}{responses.length === 0 && <EmptyState text="No responses are stored in this browser yet." />}</div></Panel></section>}
        {tab === 'roles' && <section className="admin-content"><Panel title="Roles & permissions" subtitle="Role definitions for the server-side authorization layer."><div className="admin-role-grid"><RoleCard name="Owner" description="Full control over surveys, responses, users, settings, exports and audit." permissions={['*']} /><RoleCard name="Admin" description="Manage surveys, responses and operational settings." permissions={['surveys:write', 'responses:read', 'analytics:read']} /><RoleCard name="Analyst" description="Read-only access to analytics and survey responses." permissions={['analytics:read', 'responses:read']} /></div></Panel></section>}
        {tab === 'audit' && <section className="admin-content"><Panel title="Audit log" subtitle="Every local mutation is recorded with action, target and timestamp."><div className="admin-list">{auditEvents.map((event) => <div key={event.id}><strong>{event.action}</strong><span>{event.target}</span><time>{new Date(event.at).toLocaleString()}</time></div>)}{auditEvents.length === 0 && <EmptyState text="No audit events yet." />}</div></Panel></section>}
        {tab === 'settings' && <section className="admin-content"><Panel title="Administration settings" subtitle="Safe defaults for privacy and production hardening."><div className="admin-setting-list"><div><strong>Admin indexability</strong><span>Route sends noindex/nofollow/noarchive metadata.</span><b>Protected</b></div><div><strong>Authentication</strong><span>Server-side session with HTTP-only cookie and scrypt password hash.</span><b>Enabled</b></div><div><strong>Response retention</strong><span>Keep only the minimum data required for product decisions.</span><b>Policy required</b></div><div><strong>Persistence</strong><span>Current survey data remains browser-local until the PostgreSQL RPC integration is merged.</span><b>Pending</b></div></div></Panel></section>}
      </section>
    </main>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="admin-panel"><header><h2>{title}</h2><p>{subtitle}</p></header><div>{children}</div></section>;
}
function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) { return <div className="admin-stat"><span>{icon}</span><small>{label}</small><strong>{value}</strong></div>; }
function RoleCard({ name, description, permissions }: { name: string; description: string; permissions: string[] }) { return <article className="admin-role-card"><strong>{name}</strong><p>{description}</p><div>{permissions.map((permission) => <code key={permission}>{permission}</code>)}</div></article>; }
function EmptyState({ text }: { text: string }) { return <p className="admin-empty">{text}</p>; }
