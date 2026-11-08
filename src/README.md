# src: AI-DLC by bounded context

- One folder per context: `workflow-definition`, `projection`, `packaging`, `installation`, `execution`, `cli`, plus `kernel` for shared identity values.
- Each context has `domain/` (pure types and rules), `application/` (ports and use cases), `adapters/` (IO, Zod at every file and JSON edge), `fixtures/` (test support only) and one `main.ts` composition root.
- Arrows: Workflow Definition → Projection → Packaging → Installation; Workflow Definition → Execution; the CLI composes the roots. They are data in `lint/context-map.ts` and enforced by `eslint.config.ts`.
- A context imports another context's `domain/` only; an adapter may also import an upstream `adapters/*-file.ts` file format where the map allows.
- Every exported domain or application type is one line in `glossary.json`, under its one owning context; ESLint refuses a second declaration anywhere.
- Contract files are lane 0's (`lanes.json`); ask lane 0 to change one.
- `src/` sits beside `core/` and `scripts/`: `core/` is projected content, `scripts/` is build-only, and runtime contexts ship through Packaging's `ToolBundler`.
- Typecheck: `bunx tsc --noEmit -p src/tsconfig.json`. Lint: `bun --bun ./node_modules/.bin/eslint src lint`.
