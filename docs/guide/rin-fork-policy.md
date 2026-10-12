# Rin fork policy

This page describes the maintained fork's defaults. The other upstream guide
and reference pages retain the selected upstream revision's content except the documented compatible-refresh additions in the installation/lifecycle and troubleshooting guides; their
model and provider defaults can differ from this fork. See
[installation and ownership](rin-fork-installation.md) and the
[drift inventory](../reference/rin-fork-drift.md) for the remaining seams.

## Agent model and effort defaults

The authored `tier:` classifies the work. `core/tools/aidlc-tiers.ts` defines
the shipped projections when no consumer model policy is recorded.

| Tier | Claude Code (.md frontmatter) | Codex CLI (.toml) | Kiro CLI agent JSON / Kiro IDE `.md` | Kiro CLI cli.json `chat.modelDefaults` | opencode (.md frontmatter) | Copilot (.md frontmatter) | Cursor (.md frontmatter) |
|------|-------------------------------|-------------------|--------------------------------------|-------------------------------------|-----------------------------|-----------------------------|--------------------------|
| `judgment` | `model: opus`, no `effort:` line | no `model`/`model_reasoning_effort` keys | field OMITTED (inherits session model) | no tier entry | no `model:`/`variant:` keys | omitted (inherits session model) | `model:` OMITTED (inherits session model) |
| `balanced` | `model: sonnet`, `effort: medium` | `model = "gpt-5.6-terra"`, `model_reasoning_effort = "medium"` | field OMITTED (inherits session model) | no tier entry | no `model:` key, `variant: medium` | omitted (inherits session model) | `model:` OMITTED (inherits session model) |
| `templated` | `model: sonnet`, `effort: medium` | `model = "gpt-5.6-terra"`, `model_reasoning_effort = "medium"` | field OMITTED (inherits session model) | no tier entry | no `model:` key, `variant: medium` | omitted (inherits session model) | `model:` OMITTED (inherits session model) |

`balanced` and `templated` currently project IDENTICALLY in every harness.
They remain distinct groups so consumer policy can tune them independently.
Judgment work includes multi-constraint design and implementation; balanced
work reviews against explicit criteria; templated work follows established
planning, CI/CD and runbook methods.

An omitted effort key inherits the session effort. A pinned effort overrides
the session in both directions. The wizard's `balanced` preset is separate
from the balanced tier: it records medium effort for all three groups without
changing model IDs. Consumer per-agent exceptions override group dials, which
override the shipped tier projection. The existing `tier_cap` memory setting
and `AIDLC_TIER_CAP` build override remain available.

## Provider defaults

The shipped Codex project configuration does not choose a provider or pin the
session model. Balanced and templated roles require access to `gpt-5.6-terra`.
The shipped opencode configuration and personas do not choose a provider or
pin a model; balanced and templated roles retain `variant: medium`. Consumer
authentication and provider configuration remain host-owned. Explicit Bedrock
configuration remains supported through the existing configuration flow.

## Steering and delegated stage evidence

Substantive active-space rules that the harness already supplies ambiently
remain listed in `rules_in_context` without repeated text transport. When all
applicable rules are ambient, the engine can emit `run-stage` directly.
`AIDLC_STEERING_NO_AMBIENT_DEDUPE=1` restores full transport. Missing rule text
in a transport payload does not remove that rule's authority.

When a directive carries `ensemble_dispatch`, the conductor dispatches one
collaborator for each row. Each collaborator writes its named
`contribution_path` with the supplied `identity_marker` as the first line;
those contributions are completion evidence. Required `inline_context_paths`
still need to be loaded before running the stage or dispatching collaborators.

## Maintained tool inventory

`core/tools/` contains 91 aidlc-*.ts engine and authoring tools. Colocated
`.test.ts` and `.spec.ts` files are maintainer verification sources, excluded
from installed runtime projections.
