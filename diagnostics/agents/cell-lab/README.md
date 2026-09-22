# CELL-LAB

CELL-LAB is the shared engineering laboratory for FLIXO.

Canonical protocol: P00 → P20 Cell-Lab extension.
Canonical gate: `scripts/ci/cell-lab-consensus.mjs`.
Consensus artifacts: `diagnostics/agents/cell-lab/consensus/<taskId>.json`.

Material execution cycle:

OPEN → DISCUSS → QUESTION → CHALLENGE → RESOLVE → SYNTHESIZE → CONSENSUS → EXECUTE → VERIFY → LEARN

Required core participants:
MASTER-1, MASTER-2, MASTER-3, plus the mutation owner.

No material mutation is executable without a current `AGREED` packet. Consensus is coordination evidence; it never grants mutation or certification authority.
