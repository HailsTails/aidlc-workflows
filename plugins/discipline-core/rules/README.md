# Disciplines

Adopters may select any subset in `disciplines.json`.

| ID | Title | Clauses | Files checked |
| --- | --- | --- | --- |
| [CD-1](CD-1/README.md) | No any, ever | `CD-1#any-cast` | `.ts`, `.tsx` |
| [CD-2](CD-2/README.md) | Closed enumerated list of permitted cast sites | `CD-2#cast-expressions` | `.ts`, `.tsx` |
| [CD-3](CD-3/README.md) | Strict mode flags inherited, never overridden | `CD-3#strict`, `#no-unchecked-indexed-access`, `#exact-optional-property-types`, `#no-implicit-override`, `#no-fallthrough-cases-in-switch`, `#no-property-access-from-index-signature`, `#use-unknown-in-catch-variables` | `tsconfig.json` |
| [CD-5](CD-5/README.md) | No comments, no JSDoc | `CD-5#comments-directives` | `.ts`, `.tsx` |
| [CD-6](CD-6/README.md) | Meaningful names always — no shorthand, no filler words | `CD-6#identifier-names` | `.ts`, `.tsx` |
| [CD-7](CD-7/README.md) | No categorical filenames or folder names | `CD-7#categorical-paths` | `.ts`, `.tsx` paths |
| [CD-7a](CD-7a/README.md) | No ReturnType<typeof X> for our own codebase | `CD-7a#factory-return-types` | `.ts`, `.tsx` |
| [CD-8](CD-8/README.md) | No default on switch over a closed discriminated union | `CD-8#switch-defaults` | `.ts`, `.tsx` |
| [CD-10](CD-10/README.md) | Throws permitted in exactly two contexts | `CD-10#throws-in-tests` | `*.test.ts`, `*.test.tsx` |
| [CD-14](CD-14/README.md) | Zero class authoring; classes only at external-library call sites | `CD-14#class-syntax`, `CD-14#library-construction` (review) | TypeScript, not `.d.ts` |
| [CD-15](CD-15/README.md) | Iteration is functional transformation, never an imperative loop | `CD-15#loops` | `.ts`, `.tsx` |
| [CD-17](CD-17/README.md) | Clock is the only time source | `CD-17#clock-sources` | `.ts`, `.tsx` |
| [CD-19](CD-19/README.md) | External dependencies confined to wrapping ports at the boundary | `CD-19#import-boundaries` | `.ts`, `.tsx` |
| [CD-23](CD-23/README.md) | Every unit has a co-located test sibling | `CD-23#export-test-sibling` | production `.ts`, `.tsx` |
| [CD-25](CD-25/README.md) | Unit tests fake everything outside the unit | `CD-25#dependency-isolation` | `*.test.ts`, `*.test.tsx` |
| [CD-26](CD-26/README.md) | No module-mocking — module-mock means DI is wrong | `CD-26#module-mocking` | `*.test.ts`, `*.test.tsx` |
| [CD-27](CD-27/README.md) | Tests are zero-everything — zero logic, zero branches, zero unpredictability | `CD-27#test-body-logic` | `*.test.ts`, `*.test.tsx` |
| [CD-43](CD-43/README.md) | Booleans are evaluative, not declarative | `CD-43#boolean-signatures` | `.ts`, `.tsx` |
| [CD-44](CD-44/README.md) | Functions must not mutate fields of parameters they receive | `CD-44#parameter-mutation` | `.ts`, `.tsx` |
| [CD-47](CD-47/README.md) | Tests are hermetic — no real side effects on anything real | `CD-47#hermetic-git-spawns` | `*.test.{ts,tsx,mjs,js}`, `*.spec.{ts,mjs}` |

Exceptions are recorded in `discipline-exceptions.json`; see [the package README](../README.md#discipline-exceptionsjson).
