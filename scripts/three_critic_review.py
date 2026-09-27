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
 "security":"Review only security risks. Require concrete evidence, exact lines, and exploit scenarios.",
 "logic":"Review only correctness, edge cases, state transitions, error handling, and regression risk. Give concrete failing inputs.",
 "performance":"Review only material complexity, blocking I/O, memory growth/leaks, recomputation, and realistic load impact. Ignore micro-optimizations.",
 "fixer":"Produce a patch candidate only. Never apply, commit, push, merge, or certify. Preserve tests and address evidence-backed findings only.",
}

SCHEMAS={
 "security":{"required":["verdict","confidence","cveCategoriesFound","secretLeakDetected","findings","falsePositiveRisk","needsDeterministicConfirmation"]},
 "logic":{"required":["verdict","confidence","unhandledEdgeCases","regressionRisk","regressionNotes","testCasesToAdd"]},
 "performance":{"required":["verdict","confidence","algorithmicComplexity","memoryLeakRisk","bottlenecks","estimatedLatencyDelta","acceptableForExpectedLoad"]},
 "fixer":{"required":["status","summary","unified_diff","tests_to_add"]},
}

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
        p=subprocess.run(cmd,shell=True,text=True,capture_output=True,timeout=timeout,
                         cwd=Path(os.getenv("CRITIC_REPO_ROOT",Path.cwd())).resolve())
        return ("PASS" if p.returncode==0 else "FAIL"),(p.stdout+"\n"+p.stderr)[-4000:]
    except Exception as e: return "FAIL",str(e)

def deterministic_gate():
    return Gates(
        run_cmd(os.getenv("CRITIC_TYPECHECK_CMD"))[0],
        run_cmd(os.getenv("CRITIC_LINT_CMD"))[0],
        run_cmd(os.getenv("CRITIC_UNIT_TEST_CMD"))[0],
        run_cmd(os.getenv("CRITIC_CODEQL_CMD"))[0],
    )

def gate_ready(g):
    return all(v=="PASS" for v in (g.typecheck,g.lint,g.unit,g.codeql))

def validate(value:Any,schema:dict[str,Any],name="root"):
    if not isinstance(value,dict): raise ValueError(f"{name}:object-required")
    extra=set(value)-set(schema["required"])
    missing=set(schema["required"])-set(value)
    if extra: raise ValueError(f"{name}:unexpected:{sorted(extra)}")
    if missing: raise ValueError(f"{name}:missing:{sorted(missing)}")
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
    api=client()
    tool={"name":name,"description":"Return structured JSON only.","input_schema":{"type":"object"}}
    payload=json.dumps({"goal":goal,"patch":patch,"context":context},ensure_ascii=False)
    last=None
    for _ in range(2):
        try:
            r=api.messages.create(model=MODEL,max_tokens=1800,system=system,
                                  tools=[tool],tool_choice={"type":"tool","name":name},
                                  messages=[{"role":"user","content":payload}])
            out=extract(r,name); validate(out,SCHEMAS[name],name); return out
        except (ValueError,RuntimeError) as e:
            last=e; payload+="\nSTRICT RETRY: schema-valid tool output only."
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

def confidence_ready(c):
    return all(c[k]["confidence"]>=THRESHOLDS[k] for k in THRESHOLDS)

def fixer(patch,context,goal,decision):
    api=client()
    tool={"name":"generate_repair_candidate","description":"Patch candidate only.","input_schema":{"type":"object"}}
    r=api.messages.create(model=MODEL,max_tokens=2200,system=PROMPTS["fixer"],tools=[tool],
                          tool_choice={"type":"tool","name":"generate_repair_candidate"},
                          messages=[{"role":"user","content":json.dumps({"goal":goal,"patch":patch,"context":context,"decision":decision},ensure_ascii=False)}])
    out=extract(r,"generate_repair_candidate"); validate(out,SCHEMAS["fixer"],"fixer"); return out

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
        verdict=matrix(critics,gates)
        ready=confidence_ready(critics)
        final=verdict if (ready and gate_ready(gates)) or verdict not in {"APPROVED","APPROVED_WITH_WARNING"} else "ESCALATE_TO_HUMAN"
        result={"pipeline_id":"critic-"+sha(current)[:12],"patch_hash":sha(current),"iterations_used":iteration,
                "final_verdict":final,
                "decision_reason":"Security > Logic > Performance; deterministic gates and confidence thresholds enforced.",
                "critics":critics,"action_for_fixer":None,"deterministic_checks":gates.as_dict(),
                "deterministic_gate_ready":gate_ready(gates),
                "unconfigured_checks":[k for k,v in gates.as_dict().items() if v=="SKIPPED"]}
        if final in {"SOFT_REJECT","HARD_REJECT"}:
            result["action_for_fixer"]="Repair evidence-backed findings and add targeted regression coverage."
        if final in {"APPROVED","APPROVED_WITH_WARNING"}: return result
        if iteration==MAX_ROUNDS or not run_fixer or final=="HARD_REJECT":
            result["final_verdict"]="ESCALATE_TO_HUMAN"
            return result
        candidate=fixer(current,context,goal,result)
        if candidate["status"]!="PATCH_CANDIDATE" or not candidate["unified_diff"].strip():
            result["final_verdict"]="ESCALATE_TO_HUMAN"; return result
        current=candidate["unified_diff"]
    raise AssertionError("unreachable")

def self_test():
    assert MAX_ROUNDS==3 and THRESHOLDS=={"security":0.85,"logic":0.70,"performance":0.60}
    c={"security":{"verdict":"APPROVED","confidence":0.99},"logic":{"verdict":"APPROVED","confidence":0.99},"performance":{"verdict":"APPROVED","confidence":0.99}}
    assert matrix(c,Gates("PASS","PASS","PASS","PASS"))=="APPROVED"
    assert matrix(c,Gates("PASS","SKIPPED","PASS","SKIPPED"))=="ESCALATE_TO_HUMAN"
    assert not confidence_ready({**c,"security":{"verdict":"APPROVED","confidence":0.80}})
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
