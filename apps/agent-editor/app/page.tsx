"use client";

import { useCallback } from "react";
import { ChatInterface } from "@/components/chat-interface";
import { MediaCanvas } from "@/components/media-canvas";
import { useAgentChat } from "@/lib/hooks/use-agent-chat";
import { ProjectStateSchema, type ProjectState } from "@/lib/schemas/project";

const SAMPLE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFklEQVR4nGP8////fwYkwMSABggLAAAGXQQE3kxYjAAAAABJRU5ErkJggg==";

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
    transform: { x: 0, y: 0, scaleX: 1280, scaleY: 720, rotation: 0, zIndex: 0 },
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
    manualFallbackPath,
    confirmationPending,
    confirmationPreview,
    sendMessage,
    confirmPendingExecution,
    cancelPendingExecution,
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
        manualFallbackPath={manualFallbackPath}
        confirmationPending={confirmationPending}
        confirmationPreview={confirmationPreview}
        onSendMessage={sendMessage}
        onConfirm={confirmPendingExecution}
        onCancel={cancelPendingExecution}
        onStop={stopStreaming}
      />
      <MediaCanvas
        projectState={projectState}
        onToggleVisibility={handleToggleVisibility}
      />
    </main>
  );
}
