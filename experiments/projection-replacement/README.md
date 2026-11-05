# Projection replacement experiment

Review-only source snapshot from experimental commit `0cb5b37a160a41711d1f919f31981e925fc8fe33`. This directory is separate from the main AIDLC runtime. It does not replace, deploy, or activate an installed harness.

## Contents

- `src/domain`: prepared documents, native resources, owned projection products, workflow compilation, and installation decisions.
- `src/application`: validated boundaries and orchestration.
- `src/adapters` and `src/infrastructure`: authored-source readers, harness emitters, process and storage ports.
- `examples`: runnable composition examples and behavioral tests.
- `__tests__`: retained source fixtures and test helpers.
- `native-extraction`: three unapplied source-owned command and module-inventory proposals for the fork.
- `tools/discipline-core`: the maintained checker at the recorded public fork pin. Its license and provenance are preserved.

## Run in this directory

Requires Bun 1.3.14 and Node 22.18 or newer.

    npm ci --ignore-scripts
    npm install --ignore-scripts --prefix tools/discipline-core
    npm run typecheck
    npm test
    npm run demo
    npm run disciplines
    npm run lint

Dependency installation commands are for an independent checkout. No dependencies or harnesses were installed as part of publishing this review snapshot.

## Snapshot checks

Fresh isolated verification passed strict TypeScript checking, 1,034 tests across 117 files, the runnable demo, discipline checks, and ESLint. These checks used existing dependencies. No live host activation was attempted.

## Qualification limits

The original `npm run check` is preserved. It begins with `npm run evidence`, which requires local sensor verification ledgers deliberately excluded from this public code snapshot. Therefore the full original aggregate is not reproducible from this branch alone and is not claimed to pass. Individual source, type, and behavioral checks can still run. No gate was weakened to hide that limitation.

This is experimental source, not an installed replacement or release candidate. Local source and simulated adapter tests do not certify live host activation, all-agent parity, or production deployment. The native extraction patches remain proposals.

Private conversation, workstation paths, experimental Git history, raw logs, generated runtime output, and the verification archive are not published. The retained test fixtures are intentional runnable test inputs. The repository's existing license remains in place; vendored discipline-core is MIT-0.
