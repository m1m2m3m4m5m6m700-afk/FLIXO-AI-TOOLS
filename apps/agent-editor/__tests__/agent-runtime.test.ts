import { describe, expect, it } from "vitest";
import { CANONICAL_AGENT_TOOLS, validateCanonicalAgentParameters } from "../lib/tools/canonical";
import { AgentRuntime } from "../lib/agent/runtime";
import { LLMRouter } from "../lib/llm/router";
import { ProjectStateSchema, type ProjectState } from "../lib/schemas/project";

const ISO="2026-09-27T00:00:00.000Z";
const PROJECT_ID="11111111-1111-4111-8111-111111111111";
const IMAGE_ID="22222222-2222-4222-8222-222222222222";

function buildProject():ProjectState{
  return ProjectStateSchema.parse({
    id:PROJECT_ID,title:"Test Project",dimensions:{width:1920,height:1080,fps:30},durationSec:10,
    layers:[{id:IMAGE_ID,name:"Original Photo",type:"image",url:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",visible:true,locked:false,opacity:1,transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:0,zIndex:0},metadata:{}}],
    timeline:[],createdAt:ISO,updatedAt:ISO,version:1,
  });
}

describe("Canonical Agent Tool contract",()=>{
  it("projects exactly the 10 canonical executable MVP tools",()=>{
    expect(CANONICAL_AGENT_TOOLS.map((tool)=>tool.id)).toEqual([
      "background-remover","image-upscaler","image-cropper","image-compressor","image-converter",
      "image-effects","video-trimmer","video-cropper","video-resizer","video-compressor",
    ]);
  });
  it("derives execution bindings from canonical definitions",()=>{
    for(const tool of CANONICAL_AGENT_TOOLS){
      expect(tool.name).toBe(tool.id);
      expect(tool.executionMode).toBe("LOCAL");
      expect(tool.executorId).toBe(tool.id);
      expect(tool.outputContractId).toBe(tool.id);
      expect(tool.maxPixels).toBeGreaterThan(0);
      expect(tool.maxFileSizeBytes).toBeGreaterThan(0);
    }
  });
  it("rejects unsupported parameters",()=>{
    expect(validateCanonicalAgentParameters("image-effects",{contrast:110})).toEqual({contrast:110});
    expect(()=>validateCanonicalAgentParameters("image-effects",{contrast:110,imageUrl:"https://example.com"})).toThrow();
    expect(()=>validateCanonicalAgentParameters("does-not-exist",{})).toThrow();
  });
});

describe("AgentRuntime — canonical planning only",()=>{
  it("returns a local execution plan and never executes media server-side",async()=>{
    const runtime=new AgentRuntime(CANONICAL_AGENT_TOOLS,{useMockEngine:true},new LLMRouter([]));
    const response=await runtime.processUserMessage("Remove background",[],buildProject());
    expect(response.requestedToolCalls[0]?.toolName).toBe("background-remover");
    expect(response.localExecutionPlans[0]?.executorId).toBe("background-remover");
    expect(response.toolResults).toHaveLength(0);
    expect(response.updatedProjectState).toBeUndefined();
  });
});
