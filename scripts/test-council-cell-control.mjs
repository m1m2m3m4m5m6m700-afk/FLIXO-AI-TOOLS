#!/usr/bin/env node
import assert from 'node:assert/strict';
import {CELL_HEADQUARTERS_ID,CELL_CONTROL_SEAT_ID,CELL_PRIMARY_RUNTIME_ID,CELL_CHAIR,CELL_COMMUNICATION_CHANNELS,CELL_RESPONSIBLE_AGENTS,CELL_CONTROL_SEAT,assertCellPlan,assertCellAssignment,createPresenceRequest,assertKnowledgeReturn,channelIsAllowed} from '../src/lib/council-cell-control.ts';
assert.equal(CELL_HEADQUARTERS_ID,'CELL-HQ'); assert.equal(CELL_CONTROL_SEAT_ID,'CELL-CONTROL-SEAT');
assert.equal(CELL_PRIMARY_RUNTIME_ID,'CHIEF'); assert.equal(CELL_CHAIR,'assistantController');
assert.equal(CELL_CONTROL_SEAT.mutationAuthority,false); assert.equal(CELL_CONTROL_SEAT.certificationAuthority,false);
assert.deepEqual([...CELL_COMMUNICATION_CHANNELS],['CONTROL','PRESENCE','RCA','TASK','VERIFY','KNOWLEDGE']);
assert.ok(CELL_RESPONSIBLE_AGENTS.includes('repairAgent')); assert.ok(CELL_RESPONSIBLE_AGENTS.includes('certificationAuthority'));
assert.equal(channelIsAllowed('PRESENCE'),true); assert.equal(channelIsAllowed('UNKNOWN'),false);
const sha='a'.repeat(40), plan={planId:'CELL-PLAN-001',version:1,entrySha:sha,planHash:'plan-hash',objective:'Bounded cell task',issuedBy:'assistantController',status:'ACTIVE'};
assert.doesNotThrow(()=>assertCellPlan(plan,sha));
const assignment={botId:'CELL-017',taskId:'CELL-TASK-001',scope:'READ_ONLY',planId:plan.planId,planVersion:1,entrySha:sha,expectedOutput:['evidence','knowledge']};
assert.doesNotThrow(()=>assertCellAssignment(assignment,plan,sha)); assert.throws(()=>assertCellAssignment({...assignment,entrySha:'b'.repeat(40)},plan,sha),/CELL_ASSIGNMENT_STALE_ENTRY_SHA/);
const p=createPresenceRequest({requestId:'PRESENCE-001',messageId:'presence:CELL-017:001',botId:'CELL-017',taskId:'CELL-TASK-001',priority:'P1',reason:'Conflict',exactSha:sha,evidence:['evidence://1'],requestedAction:'REVALIDATE',blocking:true});
assert.equal(p.target,'assistantController');
assert.doesNotThrow(()=>assertKnowledgeReturn({knowledgeId:'KNOW-1',botId:'CELL-017',taskId:'CELL-TASK-001',planId:plan.planId,planVersion:1,exactSha:sha,statement:'Lesson',evidence:['evidence://1'],validation:'Exact-SHA validated',reusableLesson:'Reuse only after validation',controllerAction:'TEACH'}));
console.log('CELL_CONTROL_HEADQUARTERS=PASS');
