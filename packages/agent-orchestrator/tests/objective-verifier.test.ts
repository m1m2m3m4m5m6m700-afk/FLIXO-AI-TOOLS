import assert from "node:assert/strict";
import test from "node:test";
import { ObjectiveVerifier } from "../src/objective-verifier.ts";
test("verifies objectively successful evidence",()=>{const r=new ObjectiveVerifier().verify({id:"v1",commandId:"c1",stepId:"s1",agentId:"tester",evidence:{testsPassed:4,testsFailed:0,evidenceVerified:true,outOfScopeActions:0,delegatedTasks:0}});assert.equal(r.status,"verified");});
test("rejects evidence with failed tests",()=>{const r=new ObjectiveVerifier().verify({id:"v2",commandId:"c1",stepId:"s2",agentId:"tester",evidence:{testsPassed:3,testsFailed:1,evidenceVerified:true}});assert.equal(r.status,"rejected");assert.match(r.reason,/tests/);});
test("requires independent evidence by default",()=>{const r=new ObjectiveVerifier().verify({id:"v3",commandId:"c1",stepId:"s3",agentId:"researcher",evidence:{testsPassed:2,testsFailed:0,evidenceVerified:false}});assert.equal(r.status,"rejected");assert.match(r.reason,/evidence/);});
test("returns unresolved when required evidence is insufficient",()=>{const r=new ObjectiveVerifier().verify({id:"v4",commandId:"c1",stepId:"s4",agentId:"tester",evidence:{}});assert.equal(r.status,"unresolved");});
