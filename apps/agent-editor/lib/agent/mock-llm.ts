import { z } from "zod";
import { ToolCallRequestSchema, type ToolCallRequest } from "../schemas/agent";
import { stableToken } from "../tools/mock-utils";

const MockLLMResultSchema = z.object({
  content: z.string().min(1),
  toolCalls: z.array(ToolCallRequestSchema),
});
export type MockLLMResult = z.infer<typeof MockLLMResultSchema>;

export function simulateLLMReasoning(
  prompt: string,
  callIndex = 1,
): MockLLMResult {
  const normalized = prompt.trim().toLowerCase();
  const callId = `mock_call_${stableToken([normalized, String(callIndex)])}`;

  const result: { content: string; toolCalls: ToolCallRequest[] } =
    normalized.includes("remove background") || normalized.includes("background")
      ? {
          content: "I will remove the background from the target image layer.",
          toolCalls: [
            {
              callId,
              toolName: "remove_background",
              parameters: {
                imageUrl: "https://example.com/flixo/sample-portrait.png",
                threshold: 0.5,
                outputFormat: "png",
              },
            },
          ],
        }
      : normalized.includes("lut") ||
          normalized.includes("color") ||
          normalized.includes("filter")
        ? {
            content: "I will apply a predefined color grading LUT to the target media layer.",
            toolCalls: [
              {
                callId,
                toolName: "apply_color_lut",
                parameters: {
                  mediaUrl: "https://example.com/flixo/sample-video.mp4",
                  lutName: "cinematic_warm",
                  intensity: 0.9,
                },
              },
            ],
          }
        : normalized.includes("trim") ||
            normalized.includes("cut") ||
            normalized.includes("crop video")
          ? {
              content: "I will trim the video between seconds 2 and 10.",
              toolCalls: [
                {
                  callId,
                  toolName: "trim_video",
                  parameters: {
                    videoUrl: "https://example.com/flixo/sample-video.mp4",
                    startTimeSec: 2,
                    endTimeSec: 10,
                  },
                },
              ],
            }
          : {
              content:
                "I can help with registered image and video editing operations. Describe the edit you want to perform.",
              toolCalls: [],
            };

  return MockLLMResultSchema.parse(result);
}
