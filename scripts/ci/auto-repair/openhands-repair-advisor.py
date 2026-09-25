#!/usr/bin/env python3
"""OpenHands advisory repair worker.

This worker MUST run only inside a detached temporary worktree created by the
Node adapter. It may inspect, edit, and test that temporary copy, but it never
owns the FLIXO mutation/commit lane.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from pydantic import SecretStr
from openhands.sdk import Agent, Conversation, Event, LLM, LLMConvertibleEvent, Tool
from openhands.tools.file_editor import FileEditorTool
from openhands.tools.task_tracker import TaskTrackerTool
from openhands.tools.terminal import TerminalTool


def git(cwd: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(cwd), *args],
        check=True,
        text=True,
        capture_output=True,
    )
    return result.stdout.strip()


def emit(payload: dict[str, Any]) -> int:
    output = os.environ.get("FLIXO_OPENHANDS_OUTPUT", "/tmp/flixo-openhands-advisor.json")
    Path(output).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False))
    return 0


def main() -> int:
    workspace = Path(os.environ["FLIXO_OPENHANDS_WORKSPACE"]).resolve()
    target_sha = os.environ["FLIXO_OPENHANDS_TARGET_SHA"]
    failure_log = os.environ["FLIXO_OPENHANDS_FAILURE_LOG"]
    prompt_path = os.environ["FLIXO_OPENHANDS_PROMPT_PATH"]

    if not workspace.is_dir():
        return emit({"status": "BLOCKED", "reason": "OPENHANDS_WORKSPACE_MISSING"})
    if git(workspace, "rev-parse", "HEAD") != target_sha:
        return emit({"status": "BLOCKED", "reason": "OPENHANDS_TARGET_SHA_MISMATCH"})
    if git(workspace, "branch", "--show-current") not in ("", "(HEAD detached at " + target_sha + ")"):
        return emit({"status": "BLOCKED", "reason": "OPENHANDS_WORKSPACE_NOT_DETACHED"})

    api_key = (
        os.environ.get("FLIXO_OPENHANDS_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("OPENROUTER_API_KEY")
    )
    if not api_key:
        return emit({"status": "BLOCKED_EXTERNAL", "reason": "OPENHANDS_LLM_CREDENTIAL_MISSING"})

    model = (
        os.environ.get("FLIXO_OPENHANDS_MODEL")
        or (os.environ.get("OPENROUTER_MODEL") if os.environ.get("OPENROUTER_API_KEY") else None)
        or os.environ.get("OPENAI_MODEL")
        or "gpt-5.5"
    )
    base_url = os.environ.get("FLIXO_OPENHANDS_BASE_URL")
    if not base_url and os.environ.get("OPENROUTER_API_KEY"):
        base_url = "https://openrouter.ai/api/v1"

    prompt = Path(prompt_path).read_text(encoding="utf-8")
    failure_tail = Path(failure_log).read_text(encoding="utf-8")[-24000:]

    llm = LLM(
        usage_id="flixo-repair-advisor",
        model=model,
        base_url=base_url,
        api_key=SecretStr(api_key),
    )
    agent = Agent(
        llm=llm,
        tools=[
            Tool(name=TerminalTool.name),
            Tool(name=FileEditorTool.name),
            Tool(name=TaskTrackerTool.name),
        ],
    )

    events: list[str] = []

    def callback(event: Event) -> None:
        if isinstance(event, LLMConvertibleEvent):
            events.append(str(event.to_llm_message()))

    task = (
        prompt
        + "\n\nFAILURE LOG TAIL:\n"
        + failure_tail
    )
    conversation = Conversation(agent=agent, workspace=workspace, callbacks=[callback])
    conversation.send_message(task)
    conversation.run()

    changed = git(workspace, "diff", "--name-only")
    diff = subprocess.run(
        ["git", "-C", str(workspace), "diff", "--binary"],
        check=True,
        text=True,
        capture_output=True,
    ).stdout
    summary = git(workspace, "diff", "--stat")

    return emit(
        {
            "schemaVersion": 1,
            "protocol": "FLIXO-OPENHANDS-REPAIR-ADVISOR-v1",
            "status": "COMPLETED",
            "targetSha": target_sha,
            "changedFiles": [line for line in changed.splitlines() if line],
            "diffStat": summary,
            "candidatePatch": diff[:1_000_000],
            "candidatePatchTruncated": len(diff) > 1_000_000,
            "llmEventCount": len(events),
            "lastEvents": events[-8:],
            "mutationAuthority": "NONE",
            "commitAuthority": "NONE",
            "mainMutation": False,
            "branchCreation": False,
            "verificationAuthority": "FLIXO_CANONICAL_GATES",
        }
    )


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        raise SystemExit(
            emit(
                {
                    "status": "BLOCKED_EXTERNAL",
                    "reason": "OPENHANDS_RUNTIME_FAILURE",
                    "errorType": type(exc).__name__,
                    "error": str(exc)[:1000],
                }
            )
        )
