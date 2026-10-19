# CD-1: No any, ever

## Rule

`any` is the absence of a type: it tells the compiler to stop checking, and that hole propagates silently through every call site that consumes the value. The whole reason a type system exists — catching shape errors before runtime — is forfeited at each `any`. Reach for `unknown` and narrow at the read site, or a precise union. There are no carve-outs: every `any` is a violation regardless of stated reason.

The sections below describe what the audit and ESLint checks cover.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-1#any-cast` | audit | a type assertion whose text contains `any` |
| `CD-1#explicit-any` | eslint | an `any` type anywhere in a type position |
| `CD-1#implicit-any-let` | eslint | a `let` or `var` with neither a type annotation nor an initialiser |

Review lens: [type-soundness](../../methods/lenses/type-soundness.md). The lens reviews the whole rule, including what no check flags.

## What the check flags
- `.ts` and `.tsx` files; generated folders such as `node_modules`, `dist`, `build` and `coverage` are skipped.
- A type assertion (`x as T` or `<T>x`) where the first 80 characters from the start of the assertion match `as any`, `: any` or `<any>`.
- Allowed: `as unknown`. Other casts are reported by CD-2 instead.
- A multi-argument generic such as `Map<string, any>` does not match and falls to CD-2. A bare annotation such as `let value: any` is not flagged; that part is left to review.

## What the ESLint check flags
Needs ESLint adopted through the projection; see [the ESLint piece](../../mechanisms/eslint/CD-1/README.md).
- `discipline-cd1/no-explicit-any` is typescript-eslint's `no-explicit-any` with default options. It flags every `any` type: annotations, type arguments such as `Map<string, any>`, and `as any`.
- `discipline-cd1/implicit-any-let` flags a `let` or `var` declaration in a `.ts` or `.tsx` file that has neither a type annotation nor an initialiser, one report per declaration at its first such binding. Declaration files (`.d.ts`), `const`, and `for-in` and `for-of` heads are not flagged.
- Allowed: `unknown`, `let total = 0` and `let total: number`.
- These clauses refuse exceptions, like the rest of CD-1: core rejects any entry for them as `non-exemptible-clause`.

## Example violation
```ts
const parsed = JSON.parse(text) as any;
```

## How to fix
```ts
const parsed: unknown = JSON.parse(text);
```
Narrow `unknown` with a schema or a type guard at the point of use.

## Exceptions
CD-1 cannot be exempted. Core rejects any entry in `discipline-exceptions.json` for a CD-1 clause as `non-exemptible-clause`, so there is no `authorised-location`, `file-carve-out` or clause-wide carve-out for it. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).
