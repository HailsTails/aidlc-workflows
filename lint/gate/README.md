# Foundation sweeps

Run `bun scripts/gate.ts --full --sweep` from a clean checkout of the exact
`origin/rebuild/foundation` tip after each advance. It runs every existing full
check, builds the fixtures and disables impact selection. It holds every machine
slot through the existing queue and memory floor. Partial checks, `--record` and
`--no-build` cannot produce sweep evidence.

The shared lock folder stores a verdict keyed by the exact foundation commit.
A second invocation reuses that verdict, green or red, instead of rerunning it.
An in-flight or interrupted sweep remains pending, not runtime-green. A thrown or completed failing sweep records red. Fix or revert a red foundation
on a new commit before advancing further; do not erase its evidence to retry.

Candidate test gates name their base sweep in `AIDLC_GATE`. Missing, pending or superseded sweeps are reported distinctly and do not block passing candidate checks. A recorded red base or current-foundation sweep stops landings. Cheap
checks remain available to prepare a fix. Path-scoped development checks have no
foundation base and do not certify a candidate or a foundation sweep.

The receipt distinguishes `sweepCached` from a fresh execution and reports the
advisory budget: 180 seconds for candidates, 600 seconds for sweeps. The elapsed
budget includes admission wait. Exceeding it is a note, not a loosened check or a
new failure. Existing check timings and slow-file notes identify the bottleneck.
## Phase 1 candidates

Every scoped qualification builds and checks output goldens plus the existing
install lifecycle fixtures. The gate resolves the retained previous release through lint/gate/previous-release.json, relative to the common checkout. It verifies all seven recorded release stamps and passes the path explicitly to the existing runner. Missing or failing install qualification
is red, never a skipped check. Output goldens include dist and dist-release for
all seven hosts, generated plugin trees and marketplace metadata. Install
fixtures exercise fresh install, refresh, local-edit protection, force and
upgrade through the existing real CLI runner.

Only src/**, lint/**, scripts/gate.ts and scripts/package.ts changes defer
legacy smoke/matrix execution to the enforced exact-foundation sweep. Runtime,
runner, fixture, dependency and unknown paths retain conservative legacy
selection. Changed legacy tests still run, and selected suite files are not run
again as loose tests. Source changes and package.ts run all source unit suites.

Byte hashes do not prove executable permissions, symlink behavior, native
compiled dispatcher behavior, environment-sensitive process execution or the
runtime's protocol invariants. The per-advance legacy sweep still checks those;
its capability exclusions remain explicit. Scoped output hashes alone are not
a claim that every runtime behavior is equivalent.
