import type { AgentReport } from "./index.ts";
import type { RewardResult } from "./reward.ts";

export type AgentExperience = Readonly<{
  id: string; commandId: string; stepId: string; agentId: string; objective: string;
  report: AgentReport; reward: RewardResult; timestamp: string;
}>;

export interface ExperienceStore {
  append(experience: AgentExperience): void;
  list(): readonly AgentExperience[];
  byAgent(agentId: string): readonly AgentExperience[];
  similar(objective: string, limit?: number): readonly AgentExperience[];
}

const tokenize = (value: string): Set<string> =>
  new Set(value.toLowerCase().split(/[^a-z0-9_-]+/).filter((token) => token.length > 2));

export class InMemoryExperienceStore implements ExperienceStore {
  private readonly items: AgentExperience[] = [];
  append(experience: AgentExperience): void {
    if (!experience.id.trim()) throw new Error("EXPERIENCE_ID_REQUIRED");
    if (this.items.some((item) => item.id === experience.id)) throw new Error("EXPERIENCE_ALREADY_EXISTS:" + experience.id);
    this.items.push(Object.freeze({ ...experience }));
  }
  list(): readonly AgentExperience[] { return Object.freeze([...this.items]); }
  byAgent(agentId: string): readonly AgentExperience[] {
    return Object.freeze(this.items.filter((item) => item.agentId === agentId));
  }
  similar(objective: string, limit = 5): readonly AgentExperience[] {
    const target = tokenize(objective);
    const scored = this.items.map((item) => {
      const tokens = tokenize(item.objective);
      const overlap = [...target].filter((token) => tokens.has(token)).length;
      const union = new Set([...target, ...tokens]).size;
      return { item, score: union ? overlap / union : 0 };
    });
    scored.sort((a, b) => b.score - a.score || b.item.reward.score - a.item.reward.score);
    return Object.freeze(scored.filter((entry) => entry.score > 0).slice(0, Math.max(0, limit)).map((entry) => entry.item));
  }
}
