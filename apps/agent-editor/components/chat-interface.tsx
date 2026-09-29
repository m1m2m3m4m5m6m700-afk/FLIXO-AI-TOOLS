"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import type { ChatMessage } from "@/lib/schemas/agent";
import { ChatInterfacePropsSchema } from "@/lib/ui-contracts";

export interface ChatInterfaceProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  activeTool: string | null;
  manualFallbackPath: string | null;
  confirmationPending: boolean;
  onSendMessage: (text: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onStop: () => void;
}

export function ChatInterface(props: ChatInterfaceProps) {
  const parsed = ChatInterfacePropsSchema.parse(props);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim() || parsed.isStreaming) return;
    parsed.onSendMessage(input);
    setInput("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <section className="chat-panel" aria-label="Chat workspace">
      <header className="chat-header">
        <div className="kicker">FLIXO · AGENT EDITOR</div>
        <h1 className="title">Chat workspace</h1>
      </header>
      <div className="message-list" aria-live="polite">
        {parsed.messages.map((message) => (
          <article key={message.id} className={"message " + (message.role === "user" ? "user" : "assistant")}>
            <div className="message-meta">{message.role}</div>
            <div>{message.content || (parsed.isStreaming ? "Thinking…" : "")}</div>
          </article>
        ))}
        {parsed.confirmationPending ? (
          <div className="tool-indicator" role="group" aria-label="Agent execution confirmation" data-testid="confirmation-prompt">
            <span>Agent proposed a local edit. Review the request before execution.</span>
            <button type="button" className="button send" onClick={parsed.onConfirm}>
              Confirm
            </button>
            <button type="button" className="button stop" onClick={parsed.onCancel}>
              Cancel
            </button>
          </div>
        ) : null}
        {parsed.activeTool ? (
          <div className="tool-indicator" data-testid="active-tool">
            <span aria-hidden="true">⚙</span>
            <span>Executing Tool: <strong>{parsed.activeTool}</strong></span>
          </div>
        ) : null}
        {parsed.manualFallbackPath ? (
          <a className="tool-indicator" href={parsed.manualFallbackPath} data-testid="manual-fallback">
            Open manual tool
          </a>
        ) : null}
      </div>
      <div className="chat-composer">
        <label className="kicker" htmlFor="agent-chat-input">Describe the edit</label>
        <textarea
          id="agent-chat-input"
          className="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Remove a background, apply a color LUT, or trim a video…"
          aria-label="Describe the edit"
        />
        <div className="composer-row">
          <span className="hint">Enter to send · Shift+Enter for newline</span>
          {parsed.isStreaming ? (
            <button type="button" className="button stop" onClick={parsed.onStop} aria-label="Stop">
              Stop
            </button>
          ) : (
            <button type="button" className="button send" onClick={handleSend} disabled={!input.trim()} aria-label="Send">
              Send
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
