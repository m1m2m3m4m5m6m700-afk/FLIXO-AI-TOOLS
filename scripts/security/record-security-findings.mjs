#!/usr/bin/env node
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const reportPath = process.argv.find(v => v.startsWith('--report='))?.slice(9);
if (!reportPath) throw new Error('SECURITY_LEDGER_REPORT_REQUIRED');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const repo = String(process.env.GITHUB_REPOSITORY ?? '').trim();
const token = String(process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? '').trim();
const branch = 'execution';
const expectedSha = String(report.targetSha ?? process.env.GITHUB_SHA ?? '').trim();
const ledgerPath = 'الثغرات الامنيه.md';
if (!repo || !token) throw new Error('SECURITY_LEDGER_GITHUB_AUTH_REQUIRED');
if (!/^[0-9a-f]{40}$/u.test(expectedSha)) throw new Error('SECURITY_LEDGER_EXPECTED_SHA_INVALID');
if (report.authority !== 'READ_ONLY_SECURITY_DISCOVERY' || report.mutationAuthority !== false) throw new Error('SECURITY_LEDGER_REPORT_AUTHORITY_INVALID');

const headers = {
  'Accept':'application/vnd.github+json',
  'Authorization':`Bearer ${token}`,
  'X-GitHub-Api-Version':'2022-11-28',
  'Content-Type':'application/json',
  'User-Agent':'FLIXO-Security-Red-Team'
};
const api = async (path, init={}) => {
  const res = await fetch(`https://api.github.com${path}`, { ...init, headers:{...headers,...(init.headers??{})} });
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { body = { raw:text }; }
  if (!res.ok) {
    const err = new Error(`GITHUB_API_${res.status}:${path}`);
    err.status = res.status; err.body = body;
    throw err;
  }
  return body;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function currentBranchSha() {
  const ref = await api(`/repos/${repo}/git/ref/heads/${branch}`);
  const sha = String(ref?.object?.sha ?? '');
  if (!/^[0-9a-f]{40}$/u.test(sha)) throw new Error('SECURITY_LEDGER_CURRENT_SHA_INVALID');
  if (sha !== expectedSha) {
    const compare = await api(`/repos/${repo}/compare/${expectedSha}...${sha}`);
    if (!['ahead','identical'].includes(String(compare?.status ?? ''))) {
      throw new Error(`SECURITY_LEDGER_SHA_DIVERGENCE:${expectedSha}:${sha}`);
    }
  }
  return sha;
}

function renderFinding(finding, report) {
  const repair = report.repairIntelligence ?? {};
  const fp = String(finding.fingerprint ?? '');
  return [
    `### ${finding.id}`,
    `- **الحالة:** OPEN`,
    `- **الخطورة:** ${finding.severity}`,
    `- **البوت:** ${finding.botId}`,
    `- **Exact SHA عند الاكتشاف:** \`${finding.exactSha}\``,
    `- **SHA الذي سُجّل عليه الإدخال:** \`${report.recordedOnSha ?? finding.exactSha}\``,
    `- **الفئة:** ${finding.category}`,
    `- **الملف:** \`${finding.file}:${finding.line}\``,
    `- **القاعدة:** \`${finding.title}\``,
    `- **الدليل:** ${String(finding.evidence).replaceAll('\\n',' ').slice(0,900)}`,
    `- **الثقة:** ${Number(finding.confidence ?? 0).toFixed(2)}`,
    `- **الإجراء المقترح:** ${finding.recommendation}`,
    `- **Repair Intelligence A:** ${String(repair.twinA?.preferredStrategy ?? 'N/A')} — ${String(repair.twinA?.preferredRepair ?? 'N/A').slice(0,500)}`,
    `- **Repair Intelligence B:** ${String(repair.twinB?.preferredStrategy ?? 'N/A')} — ${String(repair.twinB?.preferredRepair ?? 'N/A').slice(0,500)}`,
    `- **بصمة الثغرة:** \`${fp}\``,
    ''
  ].join('\n');
}

async function updateLedger() {
  let currentSha = await currentBranchSha();
  for (let attempt=1; attempt<=8; attempt++) {
    try {
      const contentUrl = `/repos/${repo}/contents/${encodeURIComponent(ledgerPath)}?ref=${encodeURIComponent(branch)}`;
      let existing = '';
      let fileSha = null;
      try {
        const body = await api(contentUrl);
        fileSha = String(body?.sha ?? '');
        existing = Buffer.from(String(body?.content ?? ''), 'base64').toString('utf8');
      } catch (error) {
        if (error.status !== 404) throw error;
      }

      const unique = (report.findings ?? []).filter(f => !existing.includes(String(f.fingerprint ?? '')));
      if (!unique.length) return { status:'NO_NEW_FINDINGS', recorded:0, branchSha:currentSha };

      const timestamp = new Date().toISOString();
      const header = existing.trimEnd() || [
        '# الثغرات الامنيه',
        '',
        'السجل المركزي الفوري لنتائج منظومة الريد تيم الأمنية في FLIXO-AI-TOOLS.',
        '',
        '**سياسة:**',
        '- كل إدخال مربوط بـ Exact SHA.',
        '- الثغرة المفتوحة لا تُغلق من الريد تيم.',
        '- Repair Intelligence استشاري فقط؛ لا يمنح صلاحية تعديل أو اعتماد.',
        '- الكتابة هنا append-only منطقيًا مع deduplication بالبصمة.',
        '',
        '## الإدخالات',
        ''
      ].join('\n');
      const blocks = unique.map(f => renderFinding(f, { ...report, recordedOnSha: currentSha }));
      const body = header + `\n### زيارة ${report.botId} — ${timestamp}\n\n` + blocks.join('\n');
      const putBody = {
        message:`security(red-team): record ${unique.length} finding(s) from ${report.botId}`,
        content:Buffer.from(body,'utf8').toString('base64'),
        branch,
        ...(fileSha ? { sha:fileSha } : {})
      };
      await api(`/repos/${repo}/contents/${encodeURIComponent(ledgerPath)}`, {method:'PUT', body:JSON.stringify(putBody)});
      return { status:'RECORDED', recorded:unique.length, branchSha:currentSha };
    } catch (error) {
      if (error.status !== 409 && error.status !== 422) throw error;
      await sleep(300 * attempt);
      currentSha = await currentBranchSha();
    }
  }
  throw new Error('SECURITY_LEDGER_CONCURRENT_UPDATE_RETRY_EXHAUSTED');
}

const result = await updateLedger();
console.log(JSON.stringify(result,null,2));
