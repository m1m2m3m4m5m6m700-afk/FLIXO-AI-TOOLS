import assert from 'node:assert/strict';
const source=await import('./master-repair-conversation.mjs');
const sha='a'.repeat(40);
const context=source.buildConversationContext({conversationId:'ui:test',repository:'example/repo',prNumber:1,targetSha:sha,pr:{title:'Test',head:{sha},body:'NEXT: keep context'},items:[{id:1,user:{login:'human'},type:'issue_comment',body:'وبعدين نفّذها',created_at:'2026-09-23T00:00:01Z'}]});
assert.equal(context.targetSha,sha);
assert.equal(context.participants.includes('human'),true);
assert.equal(source.contextualizeUserMessage('وبعدين نفذها',context).continuation,true);
console.log('MASTER_REPAIR_CONVERSATION_UI_CONTEXT_TEST=PASS');
