# Rin standalone disciplines

For a TS API + React repo using its own workflow, follow the
[standalone quick start](../../plugins/rin/knowledge/aidlc-shared/code-discipline/standalone-adoption.md).
It provides pinned manual knowledge-copy commands, small verified Biome, ESLint
and oxlint options, compiler checks, a deliberate fail/correct/pass probe, and
explicit coverage limits. An [optional direct-tool recipe](../../plugins/rin/knowledge/aidlc-shared/code-discipline/standalone-adoption.md#optional-run-the-existing-rin-inventory-tools-directly)
shows how to copy the existing full generated tools tree and invoke the aggregate
CD, carve-out decay and hermetic-test CLIs without installing AIDLC stages.
The guide also ships inside Rin's existing knowledge payload. It uses the existing Bun packager and manual copying; the CDs are projected knowledge, so automatic native rule loading remains a backlog gap. Full Rin plugin
installation still requires AIDLC core; there is no workflow-free plugin selector.

Use the [complete 45-CD selection inventory](../../plugins/rin/knowledge/aidlc-shared/code-discipline/standalone-cd-inventory.md) for partial-check evidence, manual coverage and progressive strict-flag adoption. No all-CD linter preset or compiler-debt ratchet is installed.
