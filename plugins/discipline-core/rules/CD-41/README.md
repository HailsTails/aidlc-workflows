# CD-41: Orchestrators contain only orchestration

## Rule

An orchestrator's body composes helper calls and assembles their results — nothing else. Inline branching or computation inside an orchestrator mixes two altitudes: the coordination it owns and the logic that belongs in a named helper. Keep orchestrators pure coordination so each level reads at one altitude.

The sections below describe what the ESLint check covers.

## Clauses

| Clause | Mechanism | Checks |
| --- | --- | --- |
| `CD-41#cognitive-complexity` | eslint | a function whose cognitive complexity is above 15 |
| `CD-41#function-length` | eslint | a function body longer than 50 lines |
| `CD-41#orchestration-only` | review | an orchestrator only composes helper calls and assembles their results |

## What the check flags
- The ESLint piece lints whatever files the team's ESLint run includes. It needs ESLint adopted through the projection; see [the ESLint piece](../../mechanisms/eslint/CD-41/README.md).
- `discipline-cd41/cognitive-complexity`: each function's cognitive complexity must be at most 15.
  - An `if`, `else if`, `switch`, ternary, `catch` and each loop adds 1 plus the current nesting depth.
  - An `else`, a `finally`, a labelled `break` or `continue`, and each run of the same logical operator add 1.
  - Nesting deepens inside `if`, loops, `switch`, `catch` and ternaries.
  - A nested function is scored on its own, starting one level deeper, and its score is not added to its parent.
  - Reported at the function's name.
- `discipline-cd41/function-length`: a function body may span at most 50 lines. Blank and comment lines count; lines holding only `{` or `}` do not. Getters and setters are not checked. Reported at the function.
- `orchestration-only` is a judgement clause. It cannot be selected and is enforced by review.

## Example violation
```ts
const settle = (orders: Order[]) => {
  for (const order of orders) {
    if (order.paid) {
      for (const line of order.lines) {
        if (line.refundable && line.quantity > 0) {
          refund(line);
        }
      }
    }
  }
};
```

## How to fix
```ts
const settle = (orders: Order[]) => orders.filter(isPaid).forEach(refundEligibleLines);
```
Move each branch into a named helper so the orchestrator only composes calls.

## Exceptions
Add an entry to `discipline-exceptions.json` at the repository root. Use `authorised-location` when a file holds a function whose shape is fixed by an external contract. Use `file-carve-out` for debt in one file: it needs a `whyChain` and is forfeited once the file is touched. Judgement clauses cannot be selected and need no exception record. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).

```json
{ "version": 1, "exceptions": [
  { "kind": "authorised-location", "clause": "CD-41#cognitive-complexity", "file": "src/legacy/tax-engine.ts", "reason": "..." }
] }
```

Every record, `authorised-location` included, also needs a `whyChain`: five `{ "why", "because", "evidence" }` steps, a `rootCause` and an `owner`. A complete record is in [the worked example](../../tests/test-fixtures/walkthrough/after/discipline-exceptions.json).
