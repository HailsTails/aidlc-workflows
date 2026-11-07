# Facts — <record slug>

Every measured claim in this record's artefacts is one row here: **one key, one claim, one value, one re-derivation**. Prose references keys and states no figure of its own.

**A correction replaces the row's value and fills `corrected-by`.** It never adds a second row for the same claim, and it never leaves the old value beside the new one — that history belongs in `memory.md`.

## Schema

| column | rule |
|---|---|
| `key` | `<PREFIX>-<N>`, unique, numerically ordered within its prefix. Prefixes group by subject and are free-form (`Q-` queue, `T-` throughput, `R-` review, `M-` measurement…). |
| `claim` | what is being asserted, in words. May reference another key (`Of Q-2, aged 0-2 days`) so derived facts state their own population. |
| `value` | the measured value. One value per row — a row holding two independent numbers is two facts. |
| `re-derive` | the exact command, query, or procedure that reproduces the value. Not a description of one. |
| `status` | `live` · `corrected` · `withdrawn` · `unmeasured` |
| `corrected-by` | empty when `live`. Otherwise the key or note that supersedes it, so a reader lands on current truth without reading history. |

`unmeasured` is a real status and must be used rather than omitting the row: a claim you could not measure is a fact about the measurement, and silently dropping it reads as "not relevant" instead of "not known".

## Facts

| key | claim | value | re-derive | status | corrected-by |
|---|---|---|---|---|---|
| **X-1** | <what this asserts> | <value> | `<command>` | live | |
| **X-2** | Of X-1, <the narrowing> | <value> | `<command>` | live | |
| **X-3** | <a claim later found wrong> | <corrected value> | `<command>` | corrected | superseded 2026-01-01; prior value and why in `memory.md` |
| **X-4** | <a claim that could not be measured> | UNMEASURED | `<command that failed, and how>` | unmeasured | |

## Worked example

Illustrative rows; these values are examples, not measurements of a consumer workspace:

| key | claim | value | re-derive | status | corrected-by |
|---|---|---|---|---|---|
| **R-1** | Audit events in the inspected records | 100 | Count events in the selected record audit files | live | |
| **R-2** | Of R-1, completed collaborator events | 40 | Filter R-1 by `SUBAGENT_COMPLETED` | live | |
| **R-3** | Of R-2, explorer completions | 10 | Filter R-2 by the explorer role | live | |
| **W-1** | Uncommitted audit events in other worktrees | UNMEASURED | The selected worktrees could not be read; repeat after access is restored | unmeasured | |

Two things that example is chosen to show:

- **R-3 states its population as a reference** (`Of R-2`), so a derived share uses the same measured population.
- **W-1 is a failed measurement recorded as a fact**, not omitted. The re-derive column says how it failed, so the next reader does not repeat it.
