---
id: CD-47
title: Tests are hermetic — no real side effects on anything real
serves-principle: V
lens: [test-discipline]
pairs-with: [cd-025, cd-026, cd-027]
status: active
applies-to: universal
portability: portable
enforced-by:
  - script:audit:hermetic-git
aidlc-enforced-by:
  - script:audit:hermetic-git
  - lefthook:audit-hermetic-git
  - ci:checks
---

A test may not touch its environment or cause any real side effect on anything real.

"Anything real" is everything the test did not itself create and does not itself dispose: the developer's repository, their user configuration and home directory, any network or live service, shared filesystem paths, the system clock, and the ambient process environment. A test constructs what it needs in an isolated location, operates only there, and removes it afterwards.

**A test fakes the real subsystem. Spawning it is permitted in exactly one closed case: the subsystem's own observable behaviour is the assertion's subject and no fake can stand in for it, because the test exists to prove what that subsystem actually does.** Two consequences, both binding:

- A test that spawns a real subsystem to *set up* state, to make a fixture look realistic, or to reach behaviour it asserts about OUR code, does not qualify — the setup is faked. Convenience, fidelity, and "it is closer to production" are not the condition; they are the reasoning this clause exists to refuse.
- Qualifying is a property of the assertion, not a judgement call. State which assertion cannot be written against a fake. If that sentence cannot be written, the test does not qualify.

Where a qualifying test spawns the subsystem, it brings its own instance; it never borrows the machine's.

This is the general invariant. It is not a rule about git — git is simply the first class of it that recurred often enough to be mechanised.

## Classes

**Real git repositories — MECHANICALLY ENFORCED.** A test that spawns a real `git` subprocess builds its environment with the shared hermetic helper (`{{HARNESS_DIR}}/tools/hermetic-git/`, authored at `plugins/rin/tools/hermetic-git/`): `createHermeticGitRepository()` for a temp repo, or `hermeticGitEnvironment()` for a bare environment. It never inherits the ambient environment and never hand-rolls a scrub.

The environment is the whole mechanism: git resolves `GIT_DIR` from the environment ahead of `cwd`, so under a git hook — which exports it — a fixture's `git init` re-initialises the shared checkout and trips git's re-init bare-guess bug, writing `core.bare=true` into the shared config and breaking the primary plus every worktree. A `cwd`-scoped call is not protection. A hand-rolled scrub is insufficient in both of its usual forms: spreading `process.env` and assigning `GIT_DIR: undefined` leaves the key enumerable rather than absent, and stripping only `GIT_*` still lets the real `~/.gitconfig` and system config reach the child.

A test qualifying under the closed case above uses the helper's temp-repo mode — never the developer's checkout, and never a repository the test did not create and dispose. **The helper is the sanctioned SHAPE for a spawn that qualifies; it is not a warrant to spawn.** A test that reaches for the helper still has to state which assertion cannot be written against a fake, and the mechanical guard cannot check that — it verifies the environment is hermetic, never that the spawn was warranted. A hermetic spawn that should have been a fake passes the walker and still violates this rule.

**Covered in principle, not yet mechanised.** These fall under the invariant and are binding at review today; none has a standing offender, so no speculative enforcement is built for them. Each becomes a class under this rule — not a new rule — when an offender appears:

- **Network and live services.** A unit test reaches no socket. Integration tests that must reach a service bring their own instance or a fake; they never call a shared or production endpoint.
- **User configuration and `HOME`.** No test reads or writes the developer's `~`, shell profile, git config, credential store, or editor settings. Where a tool consults them, the test redirects `HOME` (and the tool's own config variables) at a temp directory — the hermetic helper already does this for git.
- **Shared filesystem paths.** No test writes outside a path it created, and never to the repository working tree, a sibling worktree, or a system location.
- **Persistent environment mutation.** A test that must set a process variable restores it; it never leaves the ambient environment changed for whatever runs next.

## Enforcement

`pnpm run audit:hermetic-git` walks every `*.test.{ts,tsx,mjs,js}` / `*.spec.{ts,mjs}` and fails on any git spawn that does not pass an explicit hermetic environment. The judgement is **per call site, not per file**: a file that imports the helper for one fixture while another site still spawns ambiently is the partial-conversion shape this class keeps reappearing as, so a file-level check would pass exactly the regression most likely to happen.

It is a standalone walker rather than a constitution-audit rule because that pipeline prunes `.claude/**` by directory name and filters to `.ts`/`.tsx`, so it structurally cannot see the hook and tool tests where this class has actually bitten. Further classes are added to this same walker under this same rule; a recurrence does not spawn a bespoke rule of its own.

A file that must be exempt is listed in `.hermetic-git-allowances.json` as `{ "file": <path>, "reason": <why> }`. An entry without a non-empty reason is ignored, so an undocumented exemption fails closed rather than silently suppressing; an allowance that suppresses nothing fails the guard as stale.
