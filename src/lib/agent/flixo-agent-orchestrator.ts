import { routeThroughFlixoAgent, assertPublicAgentBoundary, type AgentRoutingDecision } from './agent-gateway-policy.ts';
import { listAdmittedModelCandidates, type ModelFabricCandidate } from './model-fabric.ts';

export type FlixoAgentRoute = Readonly<{
  routing: AgentRoutingDecision;
  models: readonly ModelFabricCandidate[];
}>;

export function routeUserRequestThroughFlixoAgent(input: string, preferredProvider?: 'openai' | 'openrouter' | 'gemini' | 'local'): FlixoAgentRoute {
  const routing = routeThroughFlixoAgent(input);
  assertPublicAgentBoundary(routing.publicAgent);
  const models = listAdmittedModelCandidates({
    taskInput: input,
    preferredProvider,
  });
  return Object.freeze({ routing, models });
}

export function assertNoDirectSpecialistInvocation(agentId: string): void {
  assertPublicAgentBoundary(agentId);
}
