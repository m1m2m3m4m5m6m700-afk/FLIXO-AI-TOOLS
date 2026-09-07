# Agent Collaboration v2 Commands

Status: `node scripts/ci/agent-coordination-protocol.mjs`

Check-in: `FLIXO_AGENT_ACTION=check-in FLIXO_AGENT_ID=agent-name FLIXO_AGENT_PATHS='path/a,path/b' FLIXO_AGENT_CONTRACTS='G4-X-001' FLIXO_AGENT_ROOT_CAUSES='RC-G4-X-001' node scripts/ci/agent-coordination-protocol.mjs`

Heartbeat: `FLIXO_AGENT_ACTION=heartbeat FLIXO_AGENT_ID=agent-name node scripts/ci/agent-coordination-protocol.mjs`

Handoff: `FLIXO_AGENT_ACTION=handoff FLIXO_AGENT_ID=agent-name FLIXO_AGENT_HANDOFF_TO=next-agent node scripts/ci/agent-coordination-protocol.mjs`

Check-out: `FLIXO_AGENT_ACTION=check-out FLIXO_AGENT_ID=agent-name node scripts/ci/agent-coordination-protocol.mjs`

Never write from an agent branch without a fresh active claim. Never continue after SHA drift. Never claim ownership from dashboard/session projection alone.