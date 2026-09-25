#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
export const MASTER_REPAIR_CONVERSATION_PROTOCOL='FLIXO-MASTER-REPAIR-CONVERSATION-v1';
export const MASTER_REPAIR_CONVERSATION_VERSION='CONVERSATION-CONTEXT-v1';
const sha256=v=>crypto.createHash('sha256').update(String(v),'utf8').digest('hex');
const clean=v=>String(v??'').replace(/\r\n/gu,'\n').trim();
const author=v=>String(v?.user?.login??v?.author?.login??v?.author?.name??'unknown');
const time=v=>String(v?.created_at??v?.submitted_at??v?.updated_at??'');
const body=v=>{const s=clean(v);return s.length<=20000?s:s.slice(0,20000)+'\n[TRUNCATED]';};
export function extractConversationSignals(text){
 const s=clean(text); const sections={};
 for(const label of ['STATUS','TARGET_SHA','FINGERPRINT','RCA','REPAIR','VERIFY','VERIFICATION','GUARDS','NEXT','BLOCKER','DECISION','QUESTION']){const m=s.match(new RegExp('(?:^|\\n)\\s*'+label+'\\s*[:=]\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z0-9 _-]{1,32}\\s*[:=]|$)','iu'));if(m?.[1])sections[label.toLowerCase()]=body(m[1]);}
 return {shas:[...new Set(s.match(/\b[a-f0-9]{40}\b/giu)??[])],fingerprints:[...new Set(s.match(/\b[a-f0-9]{64}\b/giu)??[])],runs:[...new Set([...s.matchAll(/\b(?:run|workflow(?:\s+run)?)\s*[:#=-]?\s*(\d{6,})\b/giu)].map(x=>x[1]))],jobs:[...new Set([...s.matchAll(/\bjob\s*[:#=-]?\s*(\d{6,})\b/giu)].map(x=>x[1]))],sections,questions:[...s.matchAll(/[^\n!?]{0,200}\?/gu)].map(x=>clean(x[0])).filter(Boolean).slice(0,20)};
}
export function normalizeConversationItems({pr,comments=[],reviews=[],reviewComments=[]}={}){
 const out=[{id:'pr-body',type:'pr_body',author:author(pr),role:'pull_request',createdAt:String(pr?.created_at??''),body:body(pr?.body),url:String(pr?.html_url??'')}];
 for(const x of comments)out.push({id:String(x.id),type:'issue_comment',author:author(x),role:'comment',createdAt:time(x),body:body(x.body),url:String(x.html_url??x.url??'')});
 for(const x of reviews)out.push({id:String(x.id),type:'review',author:author(x),role:String(x.state??'review'),createdAt:time(x),body:body(x.body),url:String(x.html_url??x.url??'')});
 for(const x of reviewComments)out.push({id:String(x.id),type:'review_comment',author:author(x),role:'inline_review',createdAt:time(x),body:body(x.body),url:String(x.html_url??x.url??''),path:x.path??null,line:x.line??x.original_line??null,inReplyToId:x.in_reply_to_id??null});
 return out.sort((a,b)=>Date.parse(a.createdAt||'')-Date.parse(b.createdAt||''));
}
export function buildConversationContext({conversationId,taskId=null,targetSha,failureFingerprint=null,prNumber,repository,pr={},items=[]}={}){
 if(!conversationId)throw new Error('MASTER_REPAIR_CONVERSATION_ID_REQUIRED'); if(!/^[a-f0-9]{40}$/u.test(String(targetSha)))throw new Error('MASTER_REPAIR_CONVERSATION_SHA_REQUIRED');
 const messages=normalizeConversationItems({pr,comments:items.filter(x=>x.type==='issue_comment'),reviews:items.filter(x=>x.type==='review'),reviewComments:items.filter(x=>x.type==='review_comment')});
 const all=messages.map(x=>x.body).join('\n'); const sig=extractConversationSignals(all); const decisions=[]; const openItems=[];
 for(const m of messages)for(const [k,v] of Object.entries(extractConversationSignals(m.body).sections)){if(['decision','repair','verify','verification'].includes(k))decisions.push({turnId:m.id,type:k,text:v,author:m.author,createdAt:m.createdAt});if(['next','question','blocker'].includes(k))openItems.push({turnId:m.id,type:k,text:v,author:m.author,createdAt:m.createdAt});}
 return {schemaVersion:1,protocol:MASTER_REPAIR_CONVERSATION_PROTOCOL,version:MASTER_REPAIR_CONVERSATION_VERSION,conversationId:String(conversationId),repository:String(repository??''),prNumber:Number(prNumber??0)||null,taskId:taskId?String(taskId):null,targetSha:String(targetSha),failureFingerprint:failureFingerprint?String(failureFingerprint):null,pr:{title:clean(pr?.title),state:pr?.state??null,base:String(pr?.base?.ref??''),head:String(pr?.head?.ref??''),headSha:String(pr?.head?.sha??targetSha)},participants:[...new Set(messages.map(x=>x.author))],references:sig,decisions:decisions.slice(-100),openItems:openItems.slice(-100),latestMessage:messages.at(-1)??null,messages,fullMessageCount:messages.length,currentState:{authoritativeSha:String(targetSha),latestReferencedSha:sig.shas.at(-1)??null,latestSections:sig.sections,latestQuestions:sig.questions},digest:sha256(JSON.stringify({conversationId,taskId,targetSha,failureFingerprint,pr,messages}))};
}
export function buildContextWindow(context,{message='',maxMessages=48}={}){
 const q=clean(message).toLowerCase(); const words=new Set(q.split(/\s+/u).filter(x=>x.length>2));
 const score=m=>[...words].reduce((n,w)=>n+(m.body.toLowerCase().includes(w)?1:0),0)+(m.body.includes(context.targetSha)?10:0);
 const recent=context.messages.slice(-maxMessages); const rel=context.messages.map((m,i)=>({m,i,s:score(m)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||b.i-a.i).slice(0,24).map(x=>x.m);
 const merged=new Map([...rel,...recent].map(m=>[m.type+':'+m.id,m]));
 return {protocol:MASTER_REPAIR_CONVERSATION_PROTOCOL,conversationId:context.conversationId,targetSha:context.targetSha,taskId:context.taskId,failureFingerprint:context.failureFingerprint,currentState:context.currentState,references:context.references,decisions:context.decisions.slice(-30),openItems:context.openItems.slice(-30),messages:[...merged.values()].sort((a,b)=>Date.parse(a.createdAt||'')-Date.parse(b.createdAt||'')).slice(-maxMessages),digest:sha256(JSON.stringify([...merged.values()]))};
}
export function contextualizeUserMessage(message,context){const text=clean(message);if(!text)throw new Error('MASTER_REPAIR_USER_MESSAGE_REQUIRED');const last=context?.latestMessage;const cont=/^(?:then|and|also|now|وبعدين|وبعدها|ثم|وكمان|دلوقتي|الان|الآن|تمام|طيب|هذا|هذه|ذلك|تلك)\b/i.test(text);return {original:text,continuation:cont&&Boolean(last),activeTask:context?.taskId??null,authoritativeSha:context?.targetSha??null,lastSpeaker:last?.author??null,lastMessage:last?.body??null,resolvedMessage:cont&&last?last.body+'\nUSER_FOLLOW_UP: '+text:text};}
async function api(fetchImpl,url,options={}){const r=await fetchImpl(url,options);const t=await r.text();if(!r.ok)throw new Error('MASTER_REPAIR_GITHUB_API_'+r.status);return t?JSON.parse(t):{};}
export async function loadGitHubPullRequestConversation({repository,prNumber,token=process.env.GITHUB_TOKEN??process.env.GH_TOKEN,fetchImpl=globalThis.fetch}={}){
 if(!repository||!Number.isInteger(Number(prNumber))||Number(prNumber)<1)throw new Error('MASTER_REPAIR_CONVERSATION_TARGET_REQUIRED');if(!token)throw new Error('MASTER_REPAIR_GITHUB_TOKEN_REQUIRED');
 const h={accept:'application/vnd.github+json',authorization:'Bearer '+token,'x-github-api-version':'2022-11-28'};const base='https://api.github.com/repos/'+repository;
 const [pr,comments,reviews,reviewComments]=await Promise.all([api(fetchImpl,base+'/pulls/'+prNumber,{headers:h}),api(fetchImpl,base+'/issues/'+prNumber+'/comments?per_page=100',{headers:h}),api(fetchImpl,base+'/pulls/'+prNumber+'/reviews?per_page=100',{headers:h}),api(fetchImpl,base+'/pulls/'+prNumber+'/comments?per_page=100',{headers:h})]);
 const items=[...comments.map(x=>({...x,type:'issue_comment'})),...reviews.map(x=>({...x,type:'review'})),...reviewComments.map(x=>({...x,type:'review_comment'}))];
 return {repository,prNumber:Number(prNumber),pr,comments,reviews,reviewComments,context:buildConversationContext({conversationId:'github-pr:'+repository+'#'+prNumber,repository,prNumber,pr,targetSha:String(pr.head?.sha??''),items})};
}
export async function persistConversationContext({root=process.cwd(),context,file=null}={}){if(!context?.conversationId)throw new Error('MASTER_REPAIR_CONVERSATION_CONTEXT_REQUIRED');const f=file??path.resolve(root,'diagnostics/agents/sessions/conversation-context',sha256(context.conversationId)+'.json');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(context,null,2)+'\n');return {path:f,digest:context.digest,messageCount:context.fullMessageCount};}
export function loadConversationContext({root=process.cwd(),conversationId,file=null}={}){const f=file??path.resolve(root,'diagnostics/agents/sessions/conversation-context',sha256(conversationId)+'.json');if(!fs.existsSync(f))throw new Error('MASTER_REPAIR_CONVERSATION_NOT_FOUND');return JSON.parse(fs.readFileSync(f,'utf8'));}
export async function replyToPullRequest({repository,prNumber,expectedHeadSha,body,token=process.env.GITHUB_TOKEN??process.env.GH_TOKEN,fetchImpl=globalThis.fetch}={}){
 if(!repository||!Number.isInteger(Number(prNumber))||!/^[a-f0-9]{40}$/u.test(String(expectedHeadSha))||!clean(body))throw new Error('MASTER_REPAIR_REPLY_INPUT_INVALID');if(!token)throw new Error('MASTER_REPAIR_GITHUB_TOKEN_REQUIRED');
 const h={accept:'application/vnd.github+json',authorization:'Bearer '+token,'x-github-api-version':'2022-11-28','content-type':'application/json'};const base='https://api.github.com/repos/'+repository;const pr=await api(fetchImpl,base+'/pulls/'+prNumber,{headers:h});if(String(pr.head?.sha??'')!==String(expectedHeadSha))throw new Error('MASTER_REPAIR_REPLY_STALE_SHA');
 return api(fetchImpl,base+'/issues/'+prNumber+'/comments',{method:'POST',headers:h,body:JSON.stringify({body:clean(body)})});
}
export async function interactiveConversationCycle({repository,prNumber,targetSha,taskId=null,failureFingerprint=null,userMessage,token,replyBody=null,persist=true}={}){const loaded=await loadGitHubPullRequestConversation({repository,prNumber,token});if(loaded.context.targetSha!==targetSha)throw new Error('MASTER_REPAIR_CONVERSATION_TARGET_SHA_MISMATCH');const user=contextualizeUserMessage(userMessage,loaded.context);const contextWindow=buildContextWindow(loaded.context,{message:userMessage});if(replyBody!=null)await replyToPullRequest({repository,prNumber,expectedHeadSha:targetSha,body:replyBody,token});const context={...loaded.context,taskId,failureFingerprint};if(persist)await persistConversationContext({context});return {user,contextWindow,context,replied:replyBody!=null};}
if(import.meta.url==='file://'+process.argv[1]){const cmd=process.argv[2];const repository=process.env.GITHUB_REPOSITORY??'';const prNumber=Number(process.env.FLIXO_PR_NUMBER??0);if(cmd==='read'){const r=await loadGitHubPullRequestConversation({repository,prNumber});console.log(JSON.stringify({status:'PASS',conversationId:r.context.conversationId,targetSha:r.context.targetSha,messageCount:r.context.fullMessageCount},null,2));}else throw new Error('Usage: read');}