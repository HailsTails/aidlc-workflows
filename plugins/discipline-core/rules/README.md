# Disciplines

Adopters may select any subset in `disciplines.json`.

| ID | Title | Clauses | Files checked |
| --- | --- | --- | --- |
| [CD-1](CD-1/README.md) | No any, ever | `CD-1#any-cast`, `CD-1#explicit-any`, `CD-1#implicit-any-let` | `.ts`, `.tsx` |
| [CD-2](CD-2/README.md) | Closed enumerated list of permitted cast sites | `CD-2#cast-expressions` | `.ts`, `.tsx` |
| [CD-3](CD-3/README.md) | Strict mode flags inherited, never overridden | `CD-3#strict`, `#no-unchecked-indexed-access`, `#exact-optional-property-types`, `#no-implicit-override`, `#no-fallthrough-cases-in-switch`, `#no-property-access-from-index-signature`, `#use-unknown-in-catch-variables` | `tsconfig.json` |
| [CD-4](CD-4/README.md) | Zod at every external boundary | `CD-4#boundary-validation` (review) | — |
| [CD-5](CD-5/README.md) | No comments, no JSDoc | `CD-5#comments-directives` | `.ts`, `.tsx` |
| [CD-6](CD-6/README.md) | Meaningful names always — no shorthand, no filler words | `CD-6#identifier-names`, `CD-6#naming-convention` | `.ts`, `.tsx` |
| [CD-7](CD-7/README.md) | No categorical filenames or folder names | `CD-7#categorical-paths`, `CD-7#filename-case` | `.ts`, `.tsx` paths |
| [CD-7a](CD-7a/README.md) | No ReturnType<typeof X> for our own codebase | `CD-7a#factory-return-types` | `.ts`, `.tsx` |
| [CD-8](CD-8/README.md) | No default on switch over a closed discriminated union | `CD-8#switch-defaults` | `.ts`, `.tsx` |
| [CD-9](CD-9/README.md) | All operational failures return Result<T, E> | `CD-9#result-failures` (review) | — |
| [CD-10](CD-10/README.md) | Throws permitted in exactly two contexts | `CD-10#throws-in-tests`, `CD-10#throw-only-error` | `*.test.ts`, `*.test.tsx` |
| [CD-11](CD-11/README.md) | Operational error envelopes are plain data, not classes | `CD-11#error-envelopes` (review) | — |
| [CD-12](CD-12/README.md) | Repositories are the primary storage abstraction | `CD-12#repository-ports` (review) | — |
| [CD-13](CD-13/README.md) | Kernel layer boundaries are non-negotiable | `CD-13#layer-boundaries` (review) | — |
| [CD-14](CD-14/README.md) | Zero class authoring; classes only at external-library call sites | `CD-14#class-syntax`, `CD-14#static-only-class`, `CD-14#library-construction` (review) | TypeScript, not `.d.ts` |
| [CD-15](CD-15/README.md) | Iteration is functional transformation, never an imperative loop | `CD-15#loops` | `.ts`, `.tsx` |
| [CD-16](CD-16/README.md) | No counted for loops | see CD-15 | — |
| [CD-17](CD-17/README.md) | Clock is the only time source | `CD-17#clock-sources` | `.ts`, `.tsx` |
| [CD-18](CD-18/README.md) | Process-lifecycle operations arrive through an injected port | `CD-18#process-lifecycle-ports` (review) | — |
| [CD-19](CD-19/README.md) | External dependencies confined to wrapping ports at the boundary | `CD-19#import-boundaries` | `.ts`, `.tsx` |
| [CD-20](CD-20/README.md) | Runtime stdlib imports arrive through injected ports | see CD-19 | — |
| [CD-21](CD-21/README.md) | Every injected port ships a default production factory | `CD-21#default-factories` (review) | — |
| [CD-22](CD-22/README.md) | Middleware generic context constraint | `CD-22#middleware-context` (review) | — |
| [CD-23](CD-23/README.md) | Every unit has a co-located test sibling | `CD-23#export-test-sibling` | production `.ts`, `.tsx` |
| [CD-24](CD-24/README.md) | Every file is unit-tested | see CD-23 | — |
| [CD-25](CD-25/README.md) | Unit tests fake everything outside the unit | `CD-25#dependency-isolation` | `*.test.ts`, `*.test.tsx` |
| [CD-26](CD-26/README.md) | No module-mocking — module-mock means DI is wrong | `CD-26#module-mocking` | `*.test.ts`, `*.test.tsx` |
| [CD-27](CD-27/README.md) | Tests are zero-everything — zero logic, zero branches, zero unpredictability | `CD-27#test-body-logic`, `CD-27#focused-tests`, `CD-27#skipped-tests` | `*.test.ts`, `*.test.tsx` |
| [CD-28](CD-28/README.md) | Tests assert only what the unit is directly responsible for | `CD-28#unit-responsibility` (review) | — |
| [CD-29](CD-29/README.md) | Component/integration tests are the minimum, not the bulk | `CD-29#test-pyramid` (review) | — |
| [CD-30](CD-30/README.md) | Integration tests catch composition bugs only | `CD-30#composition-only` (review) | — |
| [CD-31](CD-31/README.md) | No coverage thresholds | `CD-31#no-coverage-thresholds` (review) | — |
| [CD-32](CD-32/README.md) | PII strings redact-by-default in structured logs | `CD-32#pii-redaction` (review) | — |
| [CD-33](CD-33/README.md) | Sensitive types brand-redact unconditionally | `CD-33#sensitive-brands` (review) | — |
| [CD-34](CD-34/README.md) | Secrets never enter the repo | `CD-34#no-repo-secrets` (review) | — |
| [CD-39](CD-39/README.md) | Cite principles by Roman numeral and rules by ID | `CD-39#cite-by-id` (review) | — |
| [CD-40](CD-40/README.md) | Single-object-argument functions | `CD-40#parameter-count`, `CD-40#named-object-argument` (review) | files the ESLint run includes |
| [CD-41](CD-41/README.md) | Orchestrators contain only orchestration | `CD-41#cognitive-complexity`, `CD-41#function-length`, `CD-41#orchestration-only` (review) | files the ESLint run includes |
| [CD-42](CD-42/README.md) | Unhappy paths are early returns; happy path is the final return | `CD-42#useless-else` | files the ESLint run includes |
| [CD-43](CD-43/README.md) | Booleans are evaluative, not declarative | `CD-43#boolean-signatures` | `.ts`, `.tsx` |
| [CD-44](CD-44/README.md) | Functions must not mutate fields of parameters they receive | `CD-44#parameter-mutation`, `CD-44#parameter-reassignment` | `.ts`, `.tsx` |
| [CD-45](CD-45/README.md) | Zod runs exactly once per external-boundary crossing | `CD-45#parse-once` (review) | — |
| [CD-46](CD-46/README.md) | Touching a carved-out file revokes its carve-out — leave it clean | applied to every file carve-out | — |
| [CD-47](CD-47/README.md) | Tests are hermetic — no real side effects on anything real | `CD-47#hermetic-git-spawns` | `*.test.{ts,tsx,mjs,js}`, `*.spec.{ts,mjs}` |

Exceptions are recorded in `discipline-exceptions.json`; see [the package README](../README.md#discipline-exceptionsjson).
