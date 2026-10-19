# CD-1 ESLint piece

This piece enforces CD-1's `explicit-any` and `implicit-any-let` clauses through ESLint, in the plugin `cd1/cd1.eslint-plugin.ts` under the namespace `discipline-cd1`.

- `no-explicit-any` reuses typescript-eslint's rule with default options and flags every `any` type.
- `implicit-any-let` flags a `let` or `var` with neither a type annotation nor an initialiser in a `.ts` or `.tsx` file, once per declaration.

CD-1 refuses exceptions, so no exception record can cover these clauses.

## Adopting the rule

The projection is the only supported way to adopt these rules. Run core's project command for your repository; it writes `disciplines.eslint.mjs` at the repository root, which enables every selected rule and carries your recorded exceptions. Spread its default export last in your flat config. Core's governance run checks that the projection's effect is in force, so enabling these rules some other way is not supported and fails the run as `not-included` once any exception is recorded for it.
