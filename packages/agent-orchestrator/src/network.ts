export const AGENT_CAPABILITIES = [
  "architecture",
  "planning",
  "research",
  "implementation",
  "code-review",
  "testing",
  "security",
  "performance",
  "ui-ux",
  "integration",
  "red-team",
] as const;

export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

export const AGENT_PERMISSIONS = [
  "inspect",
  "propose",
  "execute",
  "write-code",
  "run-tests",
  "review",
  "network",
  "delegate",
] as const;

export type AgentPermission = (typeof AGENT_PERMISSIONS)[number];

export type AgentStatus =
  | "idle"
  | "dispatched"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";

export type AgentDescriptor = Readonly<{
  id: string;
  role: string;
  capabilities: readonly AgentCapability[];
  permissions: readonly AgentPermission[];
  autonomous: false;
  canDelegate: false;
}>;

export type AgentHeartbeat = Readonly<{
  commandId: string;
  stepId: string;
  agentId: string;
  status: AgentStatus;
  progressPercent: number;
  phase: string;
  timestamp: string;
}>;

export type AgentNetworkEvent = Readonly<{
  sequence: number;
  type: "command" | "dispatch" | "heartbeat" | "report" | "blocked" | "failure";
  commandId: string;
  stepId?: string;
  agentId?: string;
  timestamp: string;
  data: Readonly<Record<string, unknown>>;
}>;

export interface AgentAuditSink {
  persist(events: readonly AgentNetworkEvent[]): Promise<void>;
  finalize(status: "completed" | "failed", events: readonly AgentNetworkEvent[]): Promise<void>;
}

export type AgentNetworkSnapshot = Readonly<{
  activeCommandId: string | null;
  agents: readonly AgentDescriptor[];
  heartbeats: readonly AgentHeartbeat[];
  events: readonly AgentNetworkEvent[];
}>;

export const DEFAULT_AGENT_NETWORK: readonly AgentDescriptor[] = Object.freeze([
  { id: "architect", role: "architect", capabilities: ["architecture"], permissions: ["inspect", "propose"], autonomous: false, canDelegate: false },
  { id: "planner", role: "planner", capabilities: ["planning"], permissions: ["inspect", "propose"], autonomous: false, canDelegate: false },
  { id: "researcher", role: "researcher", capabilities: ["research"], permissions: ["inspect", "network"], autonomous: false, canDelegate: false },
  { id: "implementer", role: "implementer", capabilities: ["implementation"], permissions: ["inspect", "propose", "execute", "write-code"], autonomous: false, canDelegate: false },
  { id: "reviewer", role: "reviewer", capabilities: ["code-review"], permissions: ["inspect", "review"], autonomous: false, canDelegate: false },
  { id: "tester", role: "tester", capabilities: ["testing"], permissions: ["inspect", "run-tests"], autonomous: false, canDelegate: false },
  { id: "security", role: "security", capabilities: ["security"], permissions: ["inspect", "review"], autonomous: false, canDelegate: false },
  { id: "performance", role: "performance", capabilities: ["performance"], permissions: ["inspect", "run-tests"], autonomous: false, canDelegate: false },
  { id: "ui-ux", role: "ui-ux", capabilities: ["ui-ux"], permissions: ["inspect", "propose", "write-code"], autonomous: false, canDelegate: false },
  { id: "integrator", role: "integrator", capabilities: ["integration"], permissions: ["inspect", "execute", "write-code", "run-tests"], autonomous: false, canDelegate: false },
  { id: "red-team", role: "red-team", capabilities: ["red-team"], permissions: ["inspect", "review", "run-tests", "network"], autonomous: false, canDelegate: false },
]);

export class AgentNetworkControlPlane {
  private activeCommandId: string | null = null;
  private sequence = 0;
  private readonly agents = new Map<string, AgentDescriptor>();
  private readonly heartbeats = new Map<string, AgentHeartbeat>();
  private readonly assignments = new Map<string, string>();
  private readonly reportedSteps = new Set<string>();
  private readonly seenCommandIds = new Set<string>();
  private readonly events: AgentNetworkEvent[] = [];

  constructor(descriptors: readonly AgentDescriptor[] = DEFAULT_AGENT_NETWORK) {
    for (const descriptor of descriptors) this.register(descriptor);
  }

  register(descriptor: AgentDescriptor): void {
    if (!descriptor.id.trim()) throw new Error("AGENT_ID_REQUIRED");
    if (descriptor.autonomous || descriptor.canDelegate) throw new Error("AUTONOMOUS_AGENT_FORBIDDEN");
    const policy = DEFAULT_AGENT_NETWORK.find((candidate) => candidate.id === descriptor.id);
    if (!policy || descriptor.role !== policy.role
      || descriptor.capabilities.length !== policy.capabilities.length
      || descriptor.permissions.length !== policy.permissions.length
      || descriptor.capabilities.some((value) => !policy.capabilities.includes(value))
      || descriptor.permissions.some((value) => !policy.permissions.includes(value))) {
      throw new Error(`AGENT_POLICY_ESCALATION_FORBIDDEN:${descriptor.id}`);
    }
    if (this.agents.has(descriptor.id)) throw new Error(`AGENT_ALREADY_REGISTERED:${descriptor.id}`);
    this.agents.set(descriptor.id, Object.freeze({ ...descriptor }));
  }

  begin(commandId: string, issuedBy: "human" | "system"): void {
    if (!commandId.trim()) throw new Error("COMMAND_ID_REQUIRED");
    if (issuedBy !== "human") throw new Error("DIRECT_HUMAN_COMMAND_REQUIRED");
    if (this.activeCommandId !== null) throw new Error("COMMAND_ALREADY_ACTIVE");
    if (this.seenCommandIds.has(commandId)) throw new Error("COMMAND_ID_REUSE_FORBIDDEN");
    this.seenCommandIds.add(commandId);
    this.activeCommandId = commandId;
    this.emit("command", commandId, undefined, undefined, { issuedBy });
  }

  end(commandId: string): void {
    if (this.activeCommandId !== commandId) throw new Error("COMMAND_NOT_ACTIVE");
    this.activeCommandId = null;
  }

  authorize(stepId: string, commandId: string, role: string, requiredCapabilities: readonly AgentCapability[] = [], requiredPermissions: readonly AgentPermission[] = []): AgentDescriptor {
    this.assertActive(commandId);
    const agent = this.agents.get(role);
    if (!agent) throw new Error(`AGENT_NOT_REGISTERED:${role}`);
    if (!stepId.trim()) throw new Error("STEP_ID_REQUIRED");
    const assignmentKey = commandId + ":" + stepId;
    if (this.assignments.has(assignmentKey)) throw new Error("STEP_ALREADY_AUTHORIZED");
    if (!requiredCapabilities.every((capability) => agent.capabilities.includes(capability))) {
      throw new Error(`AGENT_CAPABILITY_DENIED:${role}`);
    }
    if (!requiredPermissions.every((permission) => agent.permissions.includes(permission))) {
      throw new Error(`AGENT_PERMISSION_DENIED:${role}`);
    }
    this.assignments.set(assignmentKey, agent.id);
    this.emit("dispatch", commandId, stepId, agent.id, { role, requiredCapabilities, requiredPermissions });
    return agent;
  }

  report(commandId: string, stepId: string, agentId: string, status: "completed" | "failed" | "blocked", summary: string): void {
    this.assertActive(commandId);
    if (!this.agents.has(agentId)) throw new Error(`AGENT_NOT_REGISTERED:${agentId}`);
    const assignmentKey = commandId + ":" + stepId;
    if (this.assignments.get(assignmentKey) !== agentId) throw new Error("AGENT_STEP_ASSIGNMENT_MISMATCH");
    if (this.reportedSteps.has(assignmentKey)) throw new Error("STEP_ALREADY_REPORTED");
    this.reportedSteps.add(assignmentKey);
    this.emit(status === "blocked" ? "blocked" : status === "failed" ? "failure" : "report", commandId, stepId, agentId, { status, summary });
  }

  heartbeat(heartbeat: AgentHeartbeat): void {
    this.assertActive(heartbeat.commandId);
    if (!this.agents.has(heartbeat.agentId)) throw new Error(`AGENT_NOT_REGISTERED:${heartbeat.agentId}`);
    if (heartbeat.progressPercent < 0 || heartbeat.progressPercent > 100) throw new Error("INVALID_PROGRESS_PERCENT");
    const key = heartbeat.commandId + ":" + heartbeat.stepId;
    if (this.assignments.get(key) !== heartbeat.agentId) throw new Error("AGENT_STEP_ASSIGNMENT_MISMATCH");
    this.heartbeats.set(key, Object.freeze({ ...heartbeat }));
    this.emit("heartbeat", heartbeat.commandId, heartbeat.stepId, heartbeat.agentId, heartbeat);
  }

  snapshot(): AgentNetworkSnapshot {
    return Object.freeze({
      activeCommandId: this.activeCommandId,
      agents: Object.freeze([...this.agents.values()]),
      heartbeats: Object.freeze([...this.heartbeats.values()]),
      events: Object.freeze([...this.events]),
    });
  }

  private assertActive(commandId: string): void {
    if (this.activeCommandId !== commandId) throw new Error("COMMAND_NOT_ACTIVE");
  }

  private emit(
    type: AgentNetworkEvent["type"],
    commandId: string,
    stepId: string | undefined,
    agentId: string | undefined,
    data: Readonly<Record<string, unknown>>,
  ): void {
    this.events.push(Object.freeze({
      sequence: ++this.sequence,
      type,
      commandId,
      stepId,
      agentId,
      timestamp: new Date().toISOString(),
      data,
    }));
  }
}


export type SupervisedAgentAdapter = Readonly<{
  descriptor: AgentDescriptor;
  execute(instruction: Readonly<{
    commandId: string;
    stepId: string;
    role: string;
    objective: string;
    constraints: readonly string[];
  }>): Promise<{
    status: "completed" | "failed" | "blocked";
    summary: string;
    evidence?: Readonly<Record<string, unknown>>;
  }>;
}>;

export class SupervisedAgentRegistry {
  private readonly adapters = new Map<string, SupervisedAgentAdapter>();

  register(adapter: SupervisedAgentAdapter): void {
    if (adapter.descriptor.autonomous || adapter.descriptor.canDelegate) {
      throw new Error("AUTONOMOUS_AGENT_FORBIDDEN");
    }
    const policy = DEFAULT_AGENT_NETWORK.find((candidate) => candidate.id === adapter.descriptor.id);
    if (!policy || adapter.descriptor.role !== policy.role
      || adapter.descriptor.capabilities.length !== policy.capabilities.length
      || adapter.descriptor.permissions.length !== policy.permissions.length
      || adapter.descriptor.capabilities.some((value) => !policy.capabilities.includes(value))
      || adapter.descriptor.permissions.some((value) => !policy.permissions.includes(value))) {
      throw new Error(`AGENT_POLICY_ESCALATION_FORBIDDEN:${adapter.descriptor.id}`);
    }
    if (this.adapters.has(adapter.descriptor.id)) {
      throw new Error(`AGENT_ALREADY_REGISTERED:${adapter.descriptor.id}`);
    }
    this.adapters.set(adapter.descriptor.id, adapter);
  }

  get(id: string): SupervisedAgentAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): readonly AgentDescriptor[] {
    return Object.freeze([...this.adapters.values()].map((adapter) => adapter.descriptor));
  }
}
