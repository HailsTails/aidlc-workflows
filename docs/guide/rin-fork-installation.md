# Building the Rin fork

This fork starts from upstream AI-DLC 2.9.0 and includes the reusable Rin plugin.
The upstream release installer in the main guide installs upstream binaries.
It does not distribute this fork. The supported fork path currently builds
from source using the existing repository packager.

For selected disciplines with your own workflow, use the [standalone manual adoption guide](rin-standalone-disciplines.md). It copies rule artifacts and configures ordinary consumer checks without installing this runtime.

## Provenance

The underlying AI-DLC framework comes from [AWS's awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows). Helen (HailsTails) maintains the Rin-specific contributions and this fork, with AI assistance. Voluntary attribution is appreciated; the [MIT No Attribution licence](../../LICENSE) imposes no attribution requirement.

## Build

Use Bun and the development dependencies from this repository's lockfile:

```bash
bun install --frozen-lockfile
bun scripts/package.ts
bun scripts/package.ts --check
```

The packager creates core distributions in `dist/<harness>/` and plugin
projections in `dist/plugins/rin/<harness>/`. Source tests and fixtures remain
in the repository and are excluded from installed runtime payloads.

Rin declares native hooks for Claude, Codex, Copilot, Cursor and OpenCode.
Kiro's two projections declare no Rin hooks. Build a single plugin projection
with the same packager:

```bash
bun scripts/package.ts plugin build rin claude /absolute/output/rin-claude
```

The standalone generic `plugin build` CLI refuses plugins declaring native
hooks. Use the repository command above for Rin; copying hook files without
their registrations does not produce a usable installation.

## Dependencies at runtime

Consumers run the installed TypeScript-named tools with Bun. They do not need
this repository's `node_modules` or a separate dependency installation.
The existing packager bundles Zod, jsonc-parser and the TypeScript compiler API
used by six audit tools. Relative imports keep the existing installed paths;
Node built-in modules remain runtime imports. Bundling the compiler adds
substantial payload size, which is a recorded candidate for later work rather
than another loader or dependency install in this migration.

## Consumer ownership

Core configuration and plugin composition use their existing installation
paths. Consumers own service configuration, credentials, project identity,
operational knowledge, model choices and permissions. The public plugin does
not carry Rin's private operating lanes.

The plugin ships the GitHub bot CLI that its `guard-github-writes` hook points agents at. Each consumer opts in by committing `aidlc/github-identity.json`; the app credentials stay in one per-user store outside every repository. See [GitHub bot identities](rin-github-bot-identity.md).

Ordinary composition retains the upstream no-clobber behavior. Explicit plugin
sync can replace unchanged owned files and remove unchanged owned files absent
from the next projection, including renamed stages. Unknown files are preserved;
modified owned files refuse the transaction. Legacy files without recorded
ownership hashes need a genuine baseline sync before deletion can be authorized.

Core refresh can include unknown consumer files in its temporary graph projection without taking ownership of them. Those files remain consumer-owned across repeated refreshes; regeneration that would change one is a conflict.

For a pre-manifest core installation, use its exact original projection to establish the baseline before changing versions. Configuration recognizes unchanged source bytes before regenerating tables; it still refuses an edited lookalike. A combined legacy projection can contain plugin files, so establish the plugin's genuine ownership with its original projection before switching to a core-only artifact. Inspect composition diagnostics and private settings before accepting either step.

## Exception why-chains (R7)

R7 is opt-in per consumer through `harness.config.json`: set `rinGates.exceptionWhyChains` to `true` to require chains on the existing registry and review-disposition surfaces. Omitted configuration leaves R7 disabled. The reusable producer supplies enforcement and the `dd-7` sensor; each consumer owns its opt-in, operating rules and project-root `.r7-legacy-baseline.json`. Installing or refreshing the plugin does not create or enlarge that baseline.

The `dd-7` sensor is advisory. Chain evidence and reasoning quality remain review responsibilities, and baseline growth has no mechanical guard. The normal Rin integration selftest checks sensor resolution against its composed graph; source tests and the legacy-baseline test helper remain excluded from installed payloads.

## Constitution engine

`harness.config.json` `constitution.engine` chooses which checker Rin's constitution surfaces run:

- `"rin-walker"` is the default when absent. The stage gate runs Rin's built-in constitution audit and carve-out decay, the `cd-*` sensors run the walker, and the review lenses read `code-discipline/cd-*.md`. Scope comes from `constitution.include` and `exclude`, and exceptions come from `.constitution-carve-outs/` and `.constitution-authorised-locations/`.
- `"discipline-core"` is for a consumer that adopted discipline-core (`disciplines.json`, `discipline-exceptions.json`, `tools/discipline-core/`). The stage gate runs `node tools/discipline-core/core/check/check-command.ts --repo <checkout>`, with `--base-revision <constitution.baseRevision>` when that is set. That is the same check CI runs, so selection, scope and exceptions all come from the consumer's own files. The `disciplines` sensor reports core's findings in the edited file, the `cd-*` and `carve-out-decay` sensors report themselves not evaluated, and the lenses read core's rule pages (`aidlc-shared/lenses/ruleset-source.md`).

The gate hook (`rin-constitution-engine-gate.ts`) is registered from the primary checkout, but it works out the checkout from the command's working directory. It reads the engine, and runs the chosen check, from that checkout's own plugin install and packages, so a worktree is judged by its own tree. The hook entry imports no third-party package. Every path that reaches no verdict on a stage completion exits 2, which blocks: a missing install, an unreadable engine, a core load failure or a timeout. Set `baseRevision` (for example `origin/main`) whenever `discipline-exceptions.json` holds a file carve-out or an entry imported with `provenance`. Moving an existing consumer is a step in discipline-core's `MIGRATING.md` and in `standalone-adoption.md` §6.

Three behaviour changes reach every consumer, including those on the default engine:

- **Rollout.** The hook registration comes from the primary checkout, but the engine is read from the worktree. So once the primary checkout syncs this version, a stage completion in a worktree whose branch predates the sync is refused. The refusal says that the checkout's rin install predates `constitution.engine`, and names the step that fixes it: merge the base branch into the worktree, or re-sync rin there. Sync or merge open worktrees when you take this version.
- **Each worktree is judged by its own tools.** The rin-walker gate and its audit tools now run from the worktree's own install, as CI does, not from the primary checkout's. A branch that edits an audit tool is therefore judged by that edit; the checkers reviewer reads such edits as governance changes.
- **A completion with no working directory is refused.** The old gate fell back to the hook's own checkout. The engine gate refuses, so it never checks a tree the command did not run in.

The `disciplines` sensor runs core's whole-repository check (ESLint included) and keeps the edited file's findings, which costs about 15 to 18 seconds per TypeScript write on a mid-sized repository. A scoped run needs a core option this version does not have.

## Fresh consumer installation

The following source-build route uses Claude as the concrete example. Replace
`/absolute/fork` with this fork checkout and `/absolute/consumer` with the
consumer project. Run these commands in a normal operator shell with Bun
available. The consumer does not need the fork's development dependencies.

First install the built core distribution:

```bash
bun /absolute/fork/core/tools/aidlc-init.ts config \
  --from /absolute/fork/dist/claude \
  --project-dir /absolute/consumer
```

Bind the existing sync command to this consumer and its built plugin projection. All three plugin-root aliases point to the same projection, so an inherited host binding cannot introduce a different plugin root:

```bash
export AIDLC_PROJECT_DIR=/absolute/consumer
export CLAUDE_PROJECT_DIR=/absolute/consumer
export AIDLC_HARNESS_DIR=.claude
export AIDLC_HARNESS_NAME=claude
export AIDLC_PLUGIN_ROOT=/absolute/fork/dist/plugins/rin/claude
export PLUGIN_ROOT=/absolute/fork/dist/plugins/rin/claude
export CLAUDE_PLUGIN_ROOT=/absolute/fork/dist/plugins/rin/claude

bun /absolute/consumer/.claude/tools/aidlc-plugin.ts sync \
  --project-dir /absolute/consumer
bun /absolute/consumer/.claude/tools/aidlc-init.ts config \
  --from /absolute/fork/dist/claude \
  --project-dir /absolute/consumer
AIDLC_RUNTIME_ROOT=/absolute/fork/dist \
bun /absolute/consumer/.claude/tools/aidlc-init.ts config project \
  --plugins aidlc,rin --yes --project-dir /absolute/consumer
bun /absolute/consumer/.claude/tools/aidlc-plugin.ts sync \
  --project-dir /absolute/consumer
```

The first sync composes the plugin, registers its available names and establishes file ownership. The following core refresh reconciles the generated scope/stage tables before explicit selection; otherwise selection can refuse the composer-updated `SKILL.md` as modified. `config project` needs a runtime source, so the command binds `AIDLC_RUNTIME_ROOT` for that invocation. Merely running its CLI from a source checkout does not provide an installed runtime. Explicit selection does not imply MCP consent. Confirm each command succeeds before continuing and inspect any reported drops or ownership conflicts. Ordinary no-clobber composition alone is not proof that old installed bodies can be deleted.

This is a project installation. It does not register a plugin in the host's user-level marketplace or cache. `aidlc-plugin list --verbose` requires full host inventory and may report `inventory-unavailable` on this route even when explicit-root sync succeeds. Keep the built plugin projection available for future syncs; it need not be an authored source checkout. The native host-plugin bootstrap is separate from the contributed project hook registrations.

For the copy archive emitted by `scripts/package-release.ts`, the equivalent roots are `runtime/<harness>/` and `plugins/rin/<harness>/` beneath the extracted archive. Set `AIDLC_RUNTIME_ROOT` to its `runtime/` directory for configuration selection. Verify the archive checksum and exact source commit before extracting it; the shared framework version alone does not distinguish this fork from upstream.

For another harness, substitute all three values in this table: the core
distribution, plugin projection and installed engine directory. Keep the
explicit harness name because Copilot and OpenCode share `.aidlc`.

| Harness name | Core distribution | Plugin projection | Installed engine directory |
|---|---|---|---|
| `claude` | `dist/claude` | `dist/plugins/rin/claude` | `.claude` |
| `codex` | `dist/codex` | `dist/plugins/rin/codex` | `.codex` |
| `copilot` | `dist/copilot` | `dist/plugins/rin/copilot` | `.aidlc` |
| `cursor` | `dist/cursor` | `dist/plugins/rin/cursor` | `.cursor` |
| `opencode` | `dist/opencode` | `dist/plugins/rin/opencode` | `.aidlc` |
| `kiro` | `dist/kiro` | `dist/plugins/rin/kiro` | `.kiro` |
| `kiro-ide` | `dist/kiro-ide` | `dist/plugins/rin/kiro-ide` | `.kiro` |

Codex consumers use a Git repository for native project-hook discovery. The existing composition and sync routes finalize the project trust seed against the resulting hook indices and native event/matcher/command identities; they do not write the user's Codex configuration. After updating an older producer, regenerate the installed seed through these routes and review the hook trust action described in the [Codex guide](harnesses/codex-cli.md). A generated seed does not itself establish that Codex has trusted or executed a hook.

## Updating an existing consumer

Core refresh retains the upstream [refresh safety gate](18-install-and-lifecycle.md#refresh-safety) by default. For a concurrent pipeline, add `--refresh-open-workflows` to the plan and apply commands below. This fork capability requires the same state schema and unchanged existing stage/scope completion contracts (advisory write-sensor registrations may change), keeps the entire `aidlc/` workspace read-only and retains ownership/conflict/rollback checks. It cannot combine with `--force` or `--mcp`. Do not close records or manufacture ownership hashes merely to make an update proceed.

Build the new fork source with the commands above. Rebind the same environment
variables to the intended consumer and current built projection. Inspect the
core refresh plan, then apply it and explicitly synchronize owned plugin files:

```bash
bun /absolute/fork/core/tools/aidlc-init.ts config \
  --from /absolute/fork/dist/claude \
  --project-dir /absolute/consumer --dry-run --verbose
bun /absolute/fork/core/tools/aidlc-init.ts config \
  --from /absolute/fork/dist/claude \
  --project-dir /absolute/consumer
bun /absolute/consumer/.claude/tools/aidlc-plugin.ts sync \
  --project-dir /absolute/consumer
```

Core refresh preserves proven selected-plugin registrations and their ownership
sidecars. Repeated refresh retains that proof. The explicit sync step opts into
replacement and deletion of unchanged recorded plugin files, including the old
stage file after a stage rename. Unrecorded legacy files remain preserved;
sync cannot manufacture their historical ownership. Modified or ambiguously
missing owned native registrations refuse even when the plugin projection
itself has not changed. Resolve the reported conflict before retrying; neither
core refresh nor sync treats unrelated consumer edits as permission to overwrite.

To deselect Rin, record core-only selection with the same environment bindings,
then synchronize:

```bash
AIDLC_RUNTIME_ROOT=/absolute/fork/dist \
bun /absolute/consumer/.claude/tools/aidlc-init.ts config project \
  --plugins aidlc --yes --project-dir /absolute/consumer
bun /absolute/consumer/.claude/tools/aidlc-plugin.ts sync \
  --project-dir /absolute/consumer
```

This removes recorded unchanged Rin registrations and owned bodies. Unknown
files are preserved. A retained compose bootstrap respects the deselection and
does not reinstall those bodies or registrations.

## Delivery status

These instructions describe the maintained source-build route and its isolated
installation tests. Fork release publication and migration of the actual
consumer checkouts remain pending; this page does not claim either is complete.
