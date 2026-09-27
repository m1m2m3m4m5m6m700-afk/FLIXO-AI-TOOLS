#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, os, subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import anthropic
except ImportError:
    anthropic = None

MODEL=os.getenv("FLIXO_AGENT_MODEL","claude-sonnet-4-6")
MAX_ROUNDS=3
THRESHOLDS={"security":0.85,"logic":0.70,"performance":0.60}

PROMPTS={
 "security":"Review only security risks. Require concrete evidence, exact lines, exploit scenarios, secret-leak evidence, and false-positive risk.",
 "logic":"Review only correctness, edge cases, state transitions, error handling, and regression risk. Give concrete failing inputs and tests to add.",
 "performance":"Review only material complexity, blocking I/O, memory growth/leaks, recomputation, and realistic load impact. Ignore micro-optimizations.",
 "fixer":"Produce a patch candidate only. Never apply, commit, push, merge, or certify. Preserve tests and address evidence-backed findings only.",
}

SECURITY_SCHEMA={
 "type":"object","additionalProperties":False,
 "properties":{
  "verdict":{"type":"string","enum":["APPROVED","REJECTED"]},
  "confidence":{"type":"number","minimum":0,"maximum":1},
  "cveCategoriesFound":{"type":"array","items":{"type":"string"}},
  "secretLeakDetected":{"type":"boolean"},
  "findings":{"type":"array","items":{"type":"object","additionalProperties":False,"properties":{
    "location":{"type":"string"},"issue":{"type":"string"},"evidence":{"type":"string"},"exploitScenario":{"type":"string"},"suggestedFix":{"type":"string"},"priority":{"type":"string","enum":["HIGH","MEDIUM","LOW"]}
  },"required":["location","issue","evidence","exploitScenario","suggestedFix","priority"]}},
  "falsePositiveRisk":{"type":"string","enum":["LOW","MEDIUM","HIGH"]},
  "needsDeterministicConfirmation":{"type":"boolean"}
 },
 "required":["verdict","confidence","cveCategoriesFound","secretLeakDetected","findings","falsePositiveRisk","needsDeterministicConfirmation"]
}

LOGIC_SCHEMA={
 "type":"object","additionalProperties":False,
 "properties":{
  "verdict":{"type":"string","enum":["APPROVED","REJECTED"]},
  "confidence":{"type":"number","minimum":0,"maximum":1},
  "unhandledEdgeCases":{"type":"array","items":{"type":"string"}},
  "regressionRisk":{"type":"string","enum":["NONE","LOW","MEDIUM","HIGH"]},
  "regressionNotes":{"type":["string","null"]},
  "testCasesToAdd":{"type":"array","items":{"type":"string"}}
 },
 "required":["verdict","confidence","unhandledEdgeCases","regressionRisk","regressionNotes","testCasesToAdd"]
}

PERFORMANCE_SCHEMA={
 "type":"object","additionalProperties":False,
 "properties":{
  "verdict":{"type":"string","enum":["APPROVED","NEEDS_OPTIMIZATION","REJECTED"]},
  "confidence":{"type":"number","minimum":0,"maximum":1},
  "algorithmicComplexity":{"type":"string"},
  "memoryLeakRisk":{"type":"boolean"},
  "bottlenecks":{"type":"array","items":{"type":"object","additionalProperties":False,"properties":{
    "location":{"type":"string"},"issue":{"type":"string"},"scaleImpact":{"type":"string"},"suggestedFix":{"type":"string"},"priority":{"type":"string","enum":["HIGH","MEDIUM","LOW"]}
  },"required":["location","issue","scaleImpact","suggestedFix","priority"]}},
  "estimatedLatencyDelta":{"type":"string"},
  "acceptableForExpectedLoad":{"type":"boolean"}
 },
 "required":["verdict","confidence","algorithmicComplexity","memoryLeakRisk","bottlenecks","estimatedLatencyDelta","acceptableForExpectedLoad"]
}

FIXER_SCHEMA={
 "type":"object","additionalProperties":False,
 "properties":{
  "status":{"type":"string","enum":["PATCH_CANDIDATE","NO_SAFE_FIX"]},
  "summary":{"type":"string"},
  "unified_diff":{"type":"string"},
  "tests_to_add":{"type":"array","items":{"type":"string"}}
 },
 "required":["status","summary","unified_diff","tests_to_add"]
}

SCHEMAS={"security":SECURITY_SCHEMA,"logic":LOGIC_SCHEMA,"performance":PERFORMANCE_SCHEMA,"fixer":FIXER_SCHEMA}

@dataclass(frozen=True)
class Gates:
    typecheck:str
    lint:str
    unit:str
    codeql:str
    semgrep:str="NOT_RUN"
    def as_dict(self): return self.__dict__.copy()

def sha(text): return hashlib.sha256(text.encode()).hexdigest()

def run_cmd(cmd, timeout=180):
    if not cmd: return "SKIPPED","NOT_CONFIGURED"
    try:
        p=subprocess.run(cmd,shell=True,text=True,capture_output=True,timeout=timeout,cwd=Path(os.getenv("CRITIC_REPO_ROOT",Path.cwd())).resolve())
        return ("PASS" if p.returncode==0 else "FAIL"),(p.stdout+"\n"+p.stderr)[-4000:]
    except Exception as e: return "FAIL",str(e)

def deterministic_gate():
    return Gates(run_cmd(os.getenv("CRITIC_TYPECHECK_CMD"))[0],run_cmd(os.getenv("CRITIC_LINT_CMD"))[0],run_cmd(os.getenv("CRITIC_UNIT_TEST_CMD"))[0],run_cmd(os.getenv("CRITIC_CODEQL_CMD"))[0])

def gate_ready(g): return all(v=="PASS" for v in (g.typecheck,g.lint,g.unit,g.codeql))

def _type_ok(v,t):
    if isinstance(t,list): return any(_type_ok(v,x) for x in t)
    return {"object":isinstance(v,dict),"array":isinstance(v,list),"string":isinstance(v,str),"number":isinstance(v,(int,float)) and not isinstance(v,bool),"boolean":isinstance(v,bool),"null":v is None}.get(t,True)

def validate(value:Any,schema:dict[str,Any],name="root"):
    if not isinstance(value,dict) or schema.get("type")!="object": raise ValueError(f"{name}:object-required")
    props=schema.get("properties",{}); required=set(schema.get("required",[])); keys=set(value)
    missing=required-keys; extra=keys-set(props)
    if missing: raise ValueError(f"{name}:missing:{sorted(missing)}")
    if extra and schema.get("additionalProperties") is False: raise ValueError(f"{name}:unexpected:{sorted(extra)}")
    def walk(v,s,p):
        if "type" in s and not _type_ok(v,s["type"]): raise ValueError(f"{p}:type")
        if "enum" in s and v not in s["enum"]: raise ValueError(f"{p}:enum")
        if isinstance(v,(int,float)) and not isinstance(v,bool):
            if "minimum" in s and v<s["minimum"]: raise ValueError(f"{p}:minimum")
            if "maximum" in s and v>s["maximum"]: raise ValueError(f"{p}:maximum")
        if isinstance(v,dict):
            pp=s.get("properties",{}); rq=set(s.get("required",[])); kk=set(v)
            if rq-kk: raise ValueError(f"{p}:missing")
            if s.get("additionalProperties") is False and kk-set(pp): raise ValueError(f"{p}:unexpected")
            for k,sub in pp.items():
                if k in v: walk(v[k],sub,p+"."+k)
        elif isinstance(v,list) and "items" in s:
            for i,item in enumerate(v): walk(item,s["items"],f"{p}[{i}]")
    for k,s in props.items():
        if k in value: walk(value[k],s,name+"."+k)
    return True

def client():
    if anthropic is None: raise RuntimeError("ANTHROPIC_SDK_MISSING")
    if not os.getenv("ANTHROPIC_API_KEY"): raise RuntimeError("ANTHROPIC_API_KEY_MISSING")
    return anthropic.Anthropic()

def extract(resp,name):
    for block in resp.content:
        if getattr(block,"type",None)=="tool_use" and block.name==name: return block.input
    raise RuntimeError(f"TOOL_RESULT_MISSING:{name}")

def call_model(system,name,patch,context,goal):
    api=client(); tool_key=name.removesuffix("_critic")
    tool={"name":name,"description":"Return structured output matching the supplied schema exactly.","input_schema":SCHEMAS[tool_key]}
    payload=json.dumps({"goal":goal,"patch":patch,"context":context},ensure_ascii=False); last=None
    for _ in range(2):
        try:
            r=api.messages.create(model=MODEL,max_tokens=1800,system=system,tools=[tool],tool_choice={"type":"tool","name":name},messages=[{"role":"user","content":payload}])
            out=extract(r,name); validate(out,SCHEMAS[tool_key],name); return out
        except (ValueError,RuntimeError) as e:
            last=e; payload+="\nSTRICT RETRY: schema-valid tool output only; no extra keys."
    raise RuntimeError(f"{name}:structured-output-invalid:{last}")

def run_critics(patch,context,goal):
    specs=[("security",PROMPTS["security"]),("logic",PROMPTS["logic"]),("performance",PROMPTS["performance"])]
    out={}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(call_model,p,name+"_critic",patch,context,goal):name for name,p in specs}
        for f in as_completed(futures): out[futures[f]]=f.result()
    return out

def semgrep(findings):
    cmd=os.getenv("CRITIC_SEMGREP_CMD")
    if not findings or not cmd: return "NOT_RUN"
    status,_=run_cmd(cmd,180)
    return "DISMISSED" if status=="PASS" else "CONFIRMED" if status=="FAIL" else "NOT_RUN"

def matrix(c,g):
    s,l,p=c["security"],c["logic"],c["performance"]
    if not gate_ready(g): return "ESCALATE_TO_HUMAN"
    if s["verdict"]=="REJECTED" and s["confidence"]>=0.8: return "HARD_REJECT"
    if s["verdict"]=="REJECTED" and s.get("needsDeterministicConfirmation"):
        if g.semgrep=="CONFIRMED": return "HARD_REJECT"
        if g.semgrep=="DISMISSED": s={**s,"verdict":"APPROVED"}
        else: return "ESCALATE_TO_HUMAN"
    if s["verdict"]=="APPROVED" and l["verdict"]=="REJECTED": return "SOFT_REJECT"
    if s["verdict"]=="APPROVED" and l["verdict"]=="APPROVED" and p["verdict"]=="NEEDS_OPTIMIZATION": return "APPROVED_WITH_WARNING"
    if s["verdict"]=="APPROVED" and l["verdict"]=="APPROVED" and p["verdict"]=="APPROVED": return "APPROVED"
    return "ESCALATE_TO_HUMAN"

def confidence_ready(c): return all(c[k]["confidence"]>=THRESHOLDS[k] for k in THRESHOLDS)

def fixer(patch,context,goal,decision):
    api=client(); tool={"name":"generate_repair_candidate","description":"Patch candidate only.","input_schema":FIXER_SCHEMA}
    r=api.messages.create(model=MODEL,max_tokens=2200,system=PROMPTS["fixer"],tools=[tool],tool_choice={"type":"tool","name":"generate_repair_candidate"},messages=[{"role":"user","content":json.dumps({"goal":goal,"patch":patch,"context":context,"decision":decision},ensure_ascii=False)}])
    out=extract(r,"generate_repair_candidate"); validate(out,FIXER_SCHEMA,"fixer"); return out

def review_patch(patch,context="",goal="Review this FLIXO patch",run_fixer=True):
    if not patch.strip(): raise ValueError("PATCH_EMPTY")
    gates=deterministic_gate()
    if any(v=="FAIL" for v in gates.as_dict().values() if v not in {"NOT_RUN"}): raise RuntimeError("DETERMINISTIC_GATE_FAILED")
    if not gate_ready(gates): raise RuntimeError("DETERMINISTIC_GATE_INCOMPLETE")
    current=patch
    for iteration in range(1,MAX_ROUNDS+1):
        critics=run_critics(current,context,goal)
        sg=semgrep(critics["security"].get("findings",[])) if critics["security"].get("verdict")=="REJECTED" and critics["security"].get("needsDeterministicConfirmation") else gates.semgrep
        gates=Gates(gates.typecheck,gates.lint,gates.unit,gates.codeql,sg)
        verdict=matrix(critics,gates); ready=confidence_ready(critics)
        final=verdict if (ready and gate_ready(gates)) or verdict not in {"APPROVED","APPROVED_WITH_WARNING"} else "ESCALATE_TO_HUMAN"
        result={"pipeline_id":"critic-"+sha(current)[:12],"patch_hash":sha(current),"iterations_used":iteration,"final_verdict":final,"decision_reason":"Applied fixed priority Security > Logic > Performance with deterministic gates and critic confidence thresholds.","critics":critics,"action_for_fixer":None,"deterministic_checks":gates.as_dict(),"deterministic_gate_ready":gate_ready(gates),"unconfigured_checks":[k for k,v in gates.as_dict().items() if v=="SKIPPED"]}
        if final in {"SOFT_REJECT","HARD_REJECT"}: result["action_for_fixer"]="Repair evidence-backed findings and add targeted regression coverage."
        if final in {"APPROVED","APPROVED_WITH_WARNING","HARD_REJECT"}: return result
        if not run_fixer: return result
        if iteration==MAX_ROUNDS:
            result["final_verdict"]="ESCALATE_TO_HUMAN"
            result["decision_reason"]="Maximum critic rounds reached without a safe, high-confidence resolution."
            return result
        candidate=fixer(current,context,goal,result)
        if candidate["status"]!="PATCH_CANDIDATE" or not candidate["unified_diff"].strip():
            result["final_verdict"]="ESCALATE_TO_HUMAN"; result["decision_reason"]="Fixer could not produce a concrete safe patch candidate."; return result
        current=candidate["unified_diff"]
    raise AssertionError("unreachable")

def self_test():
    assert MAX_ROUNDS==3 and THRESHOLDS=={"security":0.85,"logic":0.70,"performance":0.60}
    good={"verdict":"APPROVED","confidence":0.99}
    c={"security":{"verdict":"APPROVED","confidence":0.99},"logic":{"verdict":"APPROVED","confidence":0.99},"performance":{"verdict":"APPROVED","confidence":0.99}}
    assert matrix(c,Gates("PASS","PASS","PASS","PASS"))=="APPROVED"
    assert matrix(c,Gates("PASS","SKIPPED","PASS","SKIPPED"))=="ESCALATE_TO_HUMAN"
    assert not confidence_ready({**c,"security":{"verdict":"APPROVED","confidence":0.80}})
    assert matrix({**c,"logic":{"verdict":"REJECTED","confidence":0.90}},Gates("PASS","PASS","PASS","PASS"))=="SOFT_REJECT"
    assert matrix({**c,"security":{"verdict":"REJECTED","confidence":0.90,"needsDeterministicConfirmation":False}},Gates("PASS","PASS","PASS","PASS"))=="HARD_REJECT"
    invalid={"verdict":"APPROVED","confidence":1.2,"cveCategoriesFound":[],"secretLeakDetected":False,"findings":[],"falsePositiveRisk":"LOW","needsDeterministicConfirmation":False}
    try: validate(invalid,SECURITY_SCHEMA,"security")
    except ValueError: pass
    else: raise AssertionError("schema validation failed")
    print("SELF_TEST=PASS")

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--review-patch"); ap.add_argument("--context-file"); ap.add_argument("--goal",default="Review this FLIXO patch")
    ap.add_argument("--artifact",default="review-artifact.json"); ap.add_argument("--self-test",action="store_true")
    a=ap.parse_args()
    if a.self_test: self_test(); raise SystemExit(0)
    if not a.review_patch: ap.error("--review-patch is required")
    context=Path(a.context_file).read_text(encoding="utf-8") if a.context_file else ""
    result=review_patch(Path(a.review_patch).read_text(encoding="utf-8"),context,a.goal)
    Path(a.artifact).write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(0 if result["final_verdict"] in {"APPROVED","APPROVED_WITH_WARNING"} else 2)
