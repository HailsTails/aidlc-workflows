---
id: carve-out-decay
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/rin-harness-carve-out-decay.ts
default_severity: advisory
description: Ports rin CD-46 — a file carrying an active constitution carve-out forfeits it on touch; flags any git-changed file still listed in .constitution-carve-outs.json
category: constitution
enforces_cds: [CD-46]
matches: "**/*.{ts,tsx}"
input_schema:
  project_dir: string
output_schema:
  pass: boolean
  findings_count: integer
  findings: object[]
timeout_seconds: 15
---

# carve-out-decay sensor (CD-46)

This IS the CD-46 checker. Reads each CD's carve-out sidecar under
`.constitution-carve-outs/cd-<n>.json` (each entry `{files[], reason, decision}`)
and the git working set, and reports a breach for any carved file that has been
touched. Per CD-46, touching a carved file forfeits its carve-out — the change
must pay down the carved violations and delete the entry in the same change.
CD-46 itself can never be carved out.

## Failure mode

Emits `SENSOR_FAILED` with a `findings[]` payload of touched-but-still-carved
files. **Advisory as a sensor**; the BLOCKING half is folded into the
`rin-constitution-gate` PreToolUse hook, which runs the decay check before a
stage `report --result approved|completed` and `exit(2)`s on a live breach — so
a carved file cannot be silently edited under cover through a stage boundary.
