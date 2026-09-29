export type EvaluationResult = Readonly<{
  artifactValid: boolean;
  structureValid: boolean;
  pixelValid: boolean;
  goalSatisfied: boolean;
  reasons: readonly string[];
}>;

export interface VisualEvaluator {
  evaluate(input: unknown, goal: unknown): EvaluationResult;
}

export const isAcceptedEvaluation = (result: EvaluationResult): boolean =>
  result.artifactValid && result.structureValid && result.pixelValid && result.goalSatisfied;
