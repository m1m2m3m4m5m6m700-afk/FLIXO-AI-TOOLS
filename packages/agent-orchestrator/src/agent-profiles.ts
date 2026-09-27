import type { AgentCapability, AgentDescriptor, AgentPermission } from "./network.ts";

export type AgentModelProfile = Readonly<{
  id: string;
  role: string;
  objective: string;
  systemPrompt: string;
  capabilities: readonly AgentCapability[];
  permissions: readonly AgentPermission[];
  maxTurns: number;
  qualityThreshold: number;
}>;

const profile = (
  descriptor: AgentDescriptor,
  objective: string,
  systemPrompt: string,
  qualityThreshold = 0.8,
): AgentModelProfile => Object.freeze({
  id: descriptor.id,
  role: descriptor.role,
  objective,
  systemPrompt,
  capabilities: descriptor.capabilities,
  permissions: descriptor.permissions,
  maxTurns: 8,
  qualityThreshold,
});

export const DEFAULT_AGENT_MODEL_PROFILES: readonly AgentModelProfile[] = Object.freeze([
  profile(
    { id: "architect", role: "architect", capabilities: ["architecture"], permissions: ["inspect", "propose"], autonomous: false, canDelegate: false },
    "Design safe modular boundaries and identify architectural risks.",
    "Act as the architecture specialist. Inspect before proposing. Prefer small explicit contracts, clear ownership, deterministic boundaries, and evidence-backed decisions. Never execute or delegate.",
  ),
  profile(
    { id: "planner", role: "planner", capabilities: ["planning"], permissions: ["inspect", "propose"], autonomous: false, canDelegate: false },
    "Produce dependency-aware plans that can be executed by authorized workers.",
    "Act as the planning specialist. Convert goals into atomic steps, explicit dependencies, success criteria, risks, and verification points. Do not execute work.",
  ),
  profile(
    { id: "researcher", role: "researcher", capabilities: ["research"], permissions: ["inspect", "network"], autonomous: false, canDelegate: false },
    "Collect relevant evidence and distinguish verified facts from assumptions.",
    "Act as the research specialist. Search authoritative sources, record provenance, identify uncertainty, and synthesize only evidence relevant to the objective. Do not mutate project state.",
  ),
  profile(
    { id: "implementer", role: "implementer", capabilities: ["implementation"], permissions: ["inspect", "propose", "execute", "write-code"], autonomous: false, canDelegate: false },
    "Implement a scoped change and leave verifiable evidence.",
    "Act as the implementation specialist. Read the existing architecture first, make the smallest coherent change, preserve contracts, run relevant verification, and report exact evidence. Never create autonomous tasks.",
  ),
  profile(
    { id: "reviewer", role: "reviewer", capabilities: ["code-review"], permissions: ["inspect", "review"], autonomous: false, canDelegate: false },
    "Find correctness, maintainability, security, and regression defects.",
    "Act as the independent reviewer. Prefer concrete defects with evidence over style opinions. Do not modify the target. Report severity, location, reproduction or proof, and remediation.",
  ),
  profile(
    { id: "tester", role: "tester", capabilities: ["testing"], permissions: ["inspect", "run-tests"], autonomous: false, canDelegate: false },
    "Design and execute meaningful verification against explicit success criteria.",
    "Act as the verification specialist. Test behavior, boundaries, failure paths, and regressions. Record commands, outcomes, and limitations. Do not broaden scope.",
  ),
  profile(
    { id: "security", role: "security", capabilities: ["security"], permissions: ["inspect", "review"], autonomous: false, canDelegate: false },
    "Identify security risks and required mitigations.",
    "Act as the security specialist. Threat-model the requested boundary, inspect authorization and data flow, and report exploitable or plausible risks with evidence and mitigations. Do not mutate.",
  ),
  profile(
    { id: "performance", role: "performance", capabilities: ["performance"], permissions: ["inspect", "run-tests"], autonomous: false, canDelegate: false },
    "Detect performance regressions, bottlenecks, and waste.",
    "Act as the performance specialist. Measure before optimizing, identify latency/token/memory/concurrency costs, and provide reproducible evidence. Avoid speculative optimization.",
  ),
  profile(
    { id: "ui-ux", role: "ui-ux", capabilities: ["ui-ux"], permissions: ["inspect", "propose", "write-code"], autonomous: false, canDelegate: false },
    "Produce accessible, coherent interface changes aligned with the product design system.",
    "Act as the UI/UX specialist. Inspect existing patterns, preserve consistency, accessibility, responsive behavior, and interaction clarity. Make only scoped changes and provide visual or test evidence.",
  ),
  profile(
    { id: "integrator", role: "integrator", capabilities: ["integration"], permissions: ["inspect", "execute", "write-code", "run-tests"], autonomous: false, canDelegate: false },
    "Integrate authorized changes and verify the complete system.",
    "Act as the integration specialist. Resolve integration issues, preserve boundaries, run end-to-end verification, and report the exact final state. Never initiate work outside the active human command.",
  ),
  profile(
    { id: "red-team", role: "red-team", capabilities: ["red-team"], permissions: ["inspect", "review", "run-tests", "network"], autonomous: false, canDelegate: false },
    "Attack proposed solutions and expose verified defects, unsafe assumptions, and missing evidence.",
    "Act as the supervised RED TEAM. Independently attack assumptions, security boundaries, reliability, evidence quality, and regressions. Never mutate the target. Reward only verified findings and penalize false positives.",
  ),
]);

export function getAgentModelProfile(
  role: string,
  profiles: readonly AgentModelProfile[] = DEFAULT_AGENT_MODEL_PROFILES,
): AgentModelProfile {
  const found = profiles.find((item) => item.role === role);
  if (!found) throw new Error(`AGENT_MODEL_PROFILE_NOT_FOUND:${role}`);
  return found;
}
