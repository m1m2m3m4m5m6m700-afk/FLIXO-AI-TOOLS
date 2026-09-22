import fs from 'node:fs';
import crypto from 'node:crypto';

export const ATTEMPT_LEDGER_VERSION = 2;
const MAX_ATTEMPTS = 1000;
const SHA_RE = /^[a-f0-9]{40}$/u;

export function emptyAttemptLedger({ chainId = null, caseFingerprint = null } = {}) {
  return {
    version: ATTEMPT_LEDGER_VERSION,
    protocol: 'FLIXO-REPAIR-NO-REPEAT-v2',
    chainId: chainId ? String(chainId) : null,
    caseFingerprint: caseFingerprint ? String(caseFingerprint) : null,
    attempts: [],
    rejected: [],
  };
}

export function assertAttemptLedgerIdentity(ledger,{chainId=null,caseFingerprint=null}={}){if(!ledger||typeof ledger!=='object')throw new Error('REPAIR_ATTEMPT_LEDGER_INVALID');if(ledger.version!==ATTEMPT_LEDGER_VERSION)throw new Error('REPAIR_ATTEMPT_LEDGER_VERSION_MISMATCH');if(ledger.protocol!=='FLIXO-REPAIR-NO-REPEAT-v2')throw new Error('REPAIR_ATTEMPT_LEDGER_PROTOCOL_MISMATCH');if(chainId!==null&&String(ledger.chainId??'')!==String(chainId??''))throw new Error('REPAIR_ATTEMPT_LEDGER_CHAIN_ID_MISMATCH');if(caseFingerprint!==null&&String(ledger.caseFingerprint??'')!==String(caseFingerprint??''))throw new Error('REPAIR_ATTEMPT_LEDGER_FINGERPRINT_MISMATCH');if(!Array.isArray(ledger.attempts)||!Array.isArray(ledger.rejected))throw new Error('REPAIR_ATTEMPT_LEDGER_COLLECTION_INVALID');return true;}
export function normalizeAttemptLedger(source={},defaults={}){if(!source||Object.keys(source).length===0)return emptyAttemptLedger(defaults);const ledger={...source};assertAttemptLedgerIdentity(ledger,{chainId:defaults.chainId??null,caseFingerprint:defaults.caseFingerprint??null});ledger.chainId=ledger.chainId?String(ledger.chainId):null;ledger.caseFingerprint=ledger.caseFingerprint?String(ledger.caseFingerprint):null;ledger.attempts=ledger.attempts.slice(-MAX_ATTEMPTS);ledger.rejected=ledger.rejected.slice(-MAX_ATTEMPTS);return ledger;}
export function loadAttemptLedger(filePath,defaults={}){if(!fs.existsSync(filePath))return emptyAttemptLedger(defaults);let parsed;try{parsed=JSON.parse(fs.readFileSync(filePath,'utf8'));}catch(error){throw new Error('REPAIR_ATTEMPT_LEDGER_CORRUPT',{cause:error});}return normalizeAttemptLedger(parsed,defaults);}
export function saveAttemptLedger(filePath,ledger){fs.mkdirSync(filePath.split('/').slice(0,-1).join('/')||'.',{recursive:true});const normalized=normalizeAttemptLedger(ledger,{chainId:ledger?.chainId,caseFingerprint:ledger?.caseFingerprint});const tmp=filePath+'.tmp-'+process.pid;fs.writeFileSync(tmp,JSON.stringify(normalized,null,2)+'\n');fs.renameSync(tmp,filePath);return normalized;}

function env(name, fallback = '') {
  return process.env[name] ?? fallback;
}

if (process.argv[1]?.endsWith('repair-attempt-ledger.mjs')) {
  const command = process.argv[2] ?? 'contract';
  const path = env('FLIXO_REPAIR_ATTEMPT_LEDGER', '/tmp/flixo-repair-attempt-ledger.json');
  const chainId = env('FLIXO_REPAIR_CHAIN_ID');
  const caseFingerprint = env('FLIXO_FAILURE_FINGERPRINT') || env('FLIXO_LEDGER_CASE_FINGERPRINT');

  if (command === 'init') {
    saveAttemptLedger(path, emptyAttemptLedger({ chainId, caseFingerprint }));
    console.log(JSON.stringify({ status: 'PASS', chainId: chainId || null, caseFingerprint: caseFingerprint || null, rejected: 0 }));
  } else if (command === 'record') {
    const evidencePath = env('FLIXO_REPAIR_EVIDENCE_PATH', '/tmp/flixo-repair-evidence.json');
    let evidence = {};
    try { evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8')); } catch { /* missing evidence is represented by the empty record */ }
    let strategyPlan = {};
    try { strategyPlan = JSON.parse(fs.readFileSync('/tmp/flixo-repair-strategy.json', 'utf8')); } catch { /* absent strategy plan is allowed during pre-repair recording */ }
    const strategy = env('FLIXO_REPAIR_STRATEGY_ID') || strategyPlan?.strategyId || evidence?.selected || null;
    const rule = evidence?.selected || evidence?.historicalRollback?.rule || env('FLIXO_REPAIR_RULE') || null;
    const outcome = env('FLIXO_LEDGER_OUTCOME', evidence?.outcome || 'failure');
    const ledger = loadAttemptLedger(path, { chainId, caseFingerprint });
    const updated = recordRejectedAttempt(ledger, {
      chainId,
      caseFingerprint,
      runId: env('GITHUB_RUN_ID') || env('TARGET_RUN_ID') || null,
      failedSha: env('FLIXO_FAILED_SHA') || evidence?.targetSha || null,
      strategyId: strategy,
      ruleId: rule,
      outcome,
      reason: env('FLIXO_LEDGER_REASON', evidence?.escalation?.reason || 'repair-attempt-failed'),
      changedPaths: evidence?.changedPaths || [],
    });
    saveAttemptLedger(path, updated);
    console.log(JSON.stringify({
      status: 'PASS',
      chainId,
      caseFingerprint,
      strategyId: strategy,
      ruleId: rule,
      outcome,
      rejectedCount: updated.rejected.length,
    }));
  } else if (command === 'check') {
    const strategyId = env('FLIXO_REPAIR_STRATEGY_ID');
    const ruleId = env('FLIXO_REPAIR_RULE');
    const ledger = loadAttemptLedger(path, { chainId, caseFingerprint });
    const rejected = isRepairRejected(ledger, { chainId, caseFingerprint, strategyId, ruleId });
    console.log(JSON.stringify({ rejected, reasons: rejectionReasons(ledger, { chainId, caseFingerprint, strategyId, ruleId }) }));
    if (rejected) process.exit(2);
  } else {
    console.log(JSON.stringify({ version: ATTEMPT_LEDGER_VERSION, protocol: 'FLIXO-REPAIR-NO-REPEAT-v2', commands: ['init', 'record', 'check'] }));
  }
}
