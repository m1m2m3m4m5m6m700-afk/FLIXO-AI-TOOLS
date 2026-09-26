"use client";

import { useCallback } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { MediaCanvas } from "@/components/media-canvas";
import { useAgentChat } from "@/lib/hooks/use-agent-chat";
import { ProjectStateSchema, type ProjectState } from "@/lib/schemas/project";

const SAMPLE_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#0f172a"/><circle cx="640" cy="300" r="160" fill="#e2e8f0"/><text x="640" y="560" fill="#fff" font-size="52" text-anchor="middle" font-family="sans-serif">FLIXO SAMPLE</text></svg>',
  );

const INITIAL_STATE: ProjectState = ProjectStateSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  title: "Untitled Creative Project",
  dimensions: { width: 1280, height: 720, fps: 30 },
  durationSec: 10,
  layers: [{
    id: "22222222-2222-4222-8222-222222222222",
    name: "Original Source Media",
    type: "image",
    url: SAMPLE_IMAGE,
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, zIndex: 0 },
    metadata: {},
  }],
  timeline: [],
  createdAt: "2026-09-27T00:00:00.000Z",
  updatedAt: "2026-09-27T00:00:00.000Z",
  version: 1,
});

export default function AgentEditorPage() {
  const {
    messages,
    projectState,
    isStreaming,
    activeTool,
    sendMessage,
    stopStreaming,
    setProjectState,
  } = useAgentChat({ initialProjectState: INITIAL_STATE });

  const handleToggleVisibility = useCallback((layerId: string) => {
    setProjectState((previous) => {
      if (!previous) return previous;
      return ProjectStateSchema.parse({
        ...previous,
        layers: previous.layers.map((layer) =>
          layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
        ),
        updatedAt: new Date().toISOString(),
        version: previous.version + 1,
      });
    });
  }, [setProjectState]);

  return (
    <main className="app-shell">
      <ChatInterface
        messages={messages}
        isStreaming={isStreaming}
        activeTool={activeTool}
        onSendMessage={sendMessage}
        onStop={stopStreaming}
      />
      <MediaCanvas
        projectState={projectState}
        onToggleVisibility={handleToggleVisibility}
      />
    </main>
  );
}
