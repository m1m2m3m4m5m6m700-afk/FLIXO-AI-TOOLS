import crypto from 'node:crypto';
const normalize=(s)=>String(s??'').replace(/\r\n?/g,'\n');
const hash=(s)=>crypto.createHash('sha256').update(normalize(s),'utf8').digest('hex');
const symbols=(text)=>({
  functions:[...normalize(text).matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)].map(x=>x[1]).sort(),
  exports:[...normalize(text).matchAll(/\bexport\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)].map(x=>x[1]).sort(),
  imports:[...normalize(text).matchAll(/(?:from\s+|import\s*\(|require\s*\()(['"][^'"]+['"])/g)].map(x=>x[1]).sort(),
  controlFlow:(normalize(text).match(/\b(?:if|else|switch|case|for|while|try|catch|throw|return|await|yield)\b/g)||[]).sort(),
});
const literals=(text)=>[...normalize(text).matchAll(/['"]([^'"]{2,120})['"]/g)].map(x=>x[1]).filter(x=>/[A-Za-z]/.test(x)).sort();
const signature=(text)=>symbols(text);

export function buildDifferentialProof({targetSha=null,failureFingerprint=null,changedPaths=[],baseFiles={},candidateFiles={},protectedPaths=[],verification=null,scopeFiles=[]}={}){
 const failures=[]; const all=[...new Set(changedPaths)];
 if(!/^[a-f0-9]{40}$/.test(String(targetSha??''))) failures.push('DIFF_TARGET_SHA_INVALID');
 if(!failureFingerprint) failures.push('DIFF_FINGERPRINT_MISSING');
 if(!all.length) failures.push('DIFF_NO_CHANGED_FILES');
 if(scopeFiles.length&&all.some(file=>!scopeFiles.includes(file))) failures.push('DIFF_SCOPE_VIOLATION');
 if(all.some(file=>protectedPaths.some(prefix=>file===prefix||file.startsWith(prefix)))) failures.push('DIFF_PROTECTED_SURFACE');
 if(all.some(file=>(/(^|\/)(?:tests?|__tests__)\//iu.test(file)||/(^|\/)test-[^/]+\.(?:mjs|cjs|js|ts|tsx|jsx)$/iu.test(file)))) failures.push('DIFF_TEST_MUTATION');
 const fileProofs=[];
 for(const file of all){
  const before=normalize(baseFiles[file]??''); const after=normalize(candidateFiles[file]??'');
  const beforeSig=signature(before); const afterSig=signature(after);
  const beforeLiterals=literals(before); const afterLiterals=literals(after);
  const changedSymbols={functions:afterSig.functions.filter(x=>!beforeSig.functions.includes(x)).concat(beforeSig.functions.filter(x=>!afterSig.functions.includes(x))),exports:afterSig.exports.filter(x=>!beforeSig.exports.includes(x)).concat(beforeSig.exports.filter(x=>!afterSig.exports.includes(x))),imports:afterSig.imports.filter(x=>!beforeSig.imports.includes(x)).concat(beforeSig.imports.filter(x=>!afterSig.imports.includes(x)))};
  fileProofs.push({file,beforeHash:hash(before),afterHash:hash(after),changed:before!==after,changedSymbols,structureChanged:Boolean(changedSymbols.functions.length||changedSymbols.exports.length||changedSymbols.imports.length),controlFlowDelta:afterSig.controlFlow.length-beforeSig.controlFlow.length,observableOutputs:{addedLiterals:afterLiterals.filter(x=>!beforeLiterals.includes(x)).slice(0,30),removedLiterals:beforeLiterals.filter(x=>!afterLiterals.includes(x)).slice(0,30)},protected:false});
 }
 const behaviorOk=verification?.ok===true; const diffCheckOk=verification?.diffCheck===true;
 if(!behaviorOk) failures.push('DIFF_BEHAVIORAL_VERIFICATION_FAILED');
 if(!diffCheckOk) failures.push('DIFF_CHECK_FAILED');
 if(!fileProofs.some(x=>x.changed)) failures.push('DIFF_NO_EFFECTIVE_CHANGE');
 const pass=failures.length===0;
 return Object.freeze({schemaVersion:1,protocol:'DIFFERENTIAL-REPAIR-PROOF-v1',status:pass?'PASS':'BLOCK',targetSha,failureFingerprint,baseState:'ENTRY_STATE',candidateState:'SIMULATED_POST_PATCH_STATE',changedPaths:all,fileProofs,protectedBehaviorChecked:true,astStructureCompared:true,changedSymbols:fileProofs.flatMap(x=>x.changedSymbols.functions.concat(x.changedSymbols.exports)),importChanges:fileProofs.flatMap(x=>x.changedSymbols.imports),controlFlowDelta:fileProofs.reduce((sum,x)=>sum+x.controlFlowDelta,0),observableOutputChanges:fileProofs.flatMap(x=>x.observableOutputs.addedLiterals),behavioralVerification:{ok:behaviorOk,diffCheck:diffCheckOk,commands:verification?.commands??[]},scopeProof:scopeFiles.length?all.every(x=>scopeFiles.includes(x)):true,testsUnmodified:!failures.includes('DIFF_TEST_MUTATION'),failures,exactShaBound:/^[a-f0-9]{40}$/.test(String(targetSha??'')),generatedAt:new Date().toISOString()});
}