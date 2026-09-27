import importlib.util
import sys
spec=importlib.util.spec_from_file_location("critic","scripts/three_critic_review.py")
mod=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=mod
spec.loader.exec_module(mod)

assert mod.MAX_ROUNDS==3
assert mod.THRESHOLDS=={"security":0.85,"logic":0.70,"performance":0.60}
green=mod.Gates("PASS","PASS","PASS","PASS")
c={"security":{"verdict":"APPROVED","confidence":0.99},"logic":{"verdict":"APPROVED","confidence":0.99},"performance":{"verdict":"APPROVED","confidence":0.99}}
assert mod.matrix(c,green)=="APPROVED"
assert mod.matrix(c,mod.Gates("PASS","SKIPPED","PASS","SKIPPED"))=="ESCALATE_TO_HUMAN"
assert not mod.confidence_ready({**c,"security":{"verdict":"APPROVED","confidence":0.80}})
assert mod.matrix({**c,"logic":{"verdict":"REJECTED","confidence":0.90}},green)=="SOFT_REJECT"
assert mod.matrix({**c,"security":{"verdict":"REJECTED","confidence":0.91,"needsDeterministicConfirmation":False}},green)=="HARD_REJECT"
bad={"verdict":"APPROVED","confidence":2,"cveCategoriesFound":[],"secretLeakDetected":False,"findings":[],"falsePositiveRisk":"LOW","needsDeterministicConfirmation":False}
try: mod.validate(bad,mod.SECURITY_SCHEMA,"security")
except ValueError: pass
else: raise AssertionError("strict schema did not reject out-of-range confidence")
print("THREE_CRITIC_TESTS=PASS")
