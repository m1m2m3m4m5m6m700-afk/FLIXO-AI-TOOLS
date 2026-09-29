import { z } from "zod";
import { buildSystemPrompt } from "./prompts";
import { simulateLLMReasoning } from "./mock-llm";
import { AgentResponseSchema,AgentRuntimeOptionsSchema,ChatMessageSchema,MockLLMResultSchema,ToolCallRequestSchema,type AgentRuntimeOptions,type AgentResponse,type ChatMessage,type ToolCallRequest } from "../schemas/agent";
import { ProjectStateSchema,type ProjectState } from "../schemas/project";
import { LLMUnavailableError,toLLMTools,type LLMMessage,type LLMRouter,type LLMToolCall } from "../llm";
import { CANONICAL_AGENT_TOOLS,getCanonicalAgentTool,validateCanonicalAgentParameters,type CanonicalAgentTool } from "../tools/canonical";

export type { AgentRuntimeOptions } from "../schemas/agent";
export type AgentRuntimeStreamEvent={type:"token";text:string}|{type:"tool_call_start";callId:string;toolName:string}|{type:"final";response:AgentResponse};

export class AgentRuntime{
  private readonly useMockEngine:boolean;
  private readonly llmRouter?:LLMRouter;
  private readonly tools:readonly CanonicalAgentTool[];
  constructor(tools:readonly CanonicalAgentTool[]=CANONICAL_AGENT_TOOLS,options:AgentRuntimeOptions={},llmRouter?:LLMRouter){
    const parsed=AgentRuntimeOptionsSchema.parse(options);
    this.llmRouter=llmRouter;this.tools=tools;
    const live=(llmRouter?.configuredProviders().length??0)>0;
    this.useMockEngine=parsed.useMockEngine??(!live&&process.env.NODE_ENV!=="production");
  }
  async processUserMessage(userMessage:string,history:readonly ChatMessage[],currentProjectState?:ProjectState):Promise<AgentResponse>{
    let finalResponse:AgentResponse|undefined;
    for await(const event of this.streamUserMessage(userMessage,history,currentProjectState)) if(event.type==="final") finalResponse=event.response;
    if(!finalResponse) throw new Error("Agent runtime ended without a final response.");
    return AgentResponseSchema.parse(finalResponse);
  }
  async *streamUserMessage(userMessage:string,history:readonly ChatMessage[],currentProjectState?:ProjectState):AsyncGenerator<AgentRuntimeStreamEvent>{
    const prompt=z.string().trim().min(1).max(100_000).parse(userMessage);
    const parsedHistory=z.array(ChatMessageSchema).max(24).parse(history);
    const parsedProjectState=currentProjectState?ProjectStateSchema.parse(structuredClone(currentProjectState)):undefined;
    const systemPrompt=buildSystemPrompt(this.tools,parsedProjectState);
    let requestedCalls:ToolCallRequest[]=[];let assistantText="";
    if(this.useMockEngine){
      const mockResult=MockLLMResultSchema.parse(simulateLLMReasoning(prompt,1));
      requestedCalls=mockResult.toolCalls.map((call)=>this.validateToolCall(call));
      for(const call of requestedCalls) yield {type:"tool_call_start",callId:call.callId,toolName:call.toolName};
      assistantText=mockResult.content;
    }else{
      if(!this.llmRouter) throw new LLMUnavailableError("REAL_LLM_ENGINE_NOT_CONFIGURED");
      const messages:LLMMessage[]=parsedHistory.filter((message)=>message.role!=="system").map((message)=>({
        role:message.role,content:message.content,
        toolCalls:message.toolCalls?.map((call)=>({callId:call.callId,toolName:call.toolName,arguments:call.parameters})),
        toolResults:message.toolResults?.map((result)=>({callId:result.callId,toolName:result.toolName,result:result.data??{error:"tool_execution_failed"},isError:result.status==="error"})),
      }));
      messages.push({role:"user",content:prompt});
      for await(const event of this.llmRouter.stream({model:"",systemPrompt,messages,tools:toLLMTools(this.tools)})){
        if(event.type==="text_delta"){assistantText+=event.text;yield {type:"token",text:event.text};}
        else if(event.type==="turn_end") requestedCalls=event.toolCalls.map((call)=>this.validateToolCall(ToolCallRequestSchema.parse({callId:call.callId,toolName:call.toolName,parameters:call.arguments})));
      }
      for(const call of requestedCalls) yield {type:"tool_call_start",callId:call.callId,toolName:call.toolName};
    }
    yield {type:"final",response:this.buildResponse(assistantText||"I prepared a canonical local execution plan.",requestedCalls,parsedProjectState)};
  }
  private validateToolCall(call:ToolCallRequest):ToolCallRequest{
    const tool=getCanonicalAgentTool(call.toolName);
    if(!tool||!this.tools.some((candidate)=>candidate.id===call.toolName)) throw new Error(`CANONICAL_TOOL_NOT_EXECUTABLE:${call.toolName}`);
    return ToolCallRequestSchema.parse({...call,parameters:validateCanonicalAgentParameters(call.toolName,call.parameters)});
  }
  private buildResponse(content:string,calls:readonly ToolCallRequest[],projectState?:ProjectState):AgentResponse{
    return AgentResponseSchema.parse({
      messageId:crypto.randomUUID(),content,requestedToolCalls:calls,
      localExecutionPlans:calls.map((call)=>{
        const tool=getCanonicalAgentTool(call.toolName);
        if(!tool) throw new Error(`CANONICAL_TOOL_NOT_EXECUTABLE:${call.toolName}`);
        return {callId:call.callId,toolName:call.toolName,executorId:tool.executorId,maxPixels:tool.maxPixels,maxFileSizeBytes:tool.maxFileSizeBytes,outputContractId:tool.outputContractId};
      }),
      toolResults:[],updatedProjectState:undefined,requiresUserConfirmation:calls.length>0,
    });
  }
}
