# Review methods

These are review methods for applying the rule pages' judgement clauses, and for reviewing the mechanical ones beyond what their checks see.

| Lens | Concern |
| --- | --- |
| [type-soundness](lenses/type-soundness.md) | This lens defends **the integrity of the type system as a source of truth**: the type the compiler sees must be the type the value actually has, and the type must declare state rather than make the reader evaluate it. |
| [zod-boundary](lenses/zod-boundary.md) | This lens defends **boundary validation discipline**: external, typeless input is validated exactly once, at the seam where it enters the system, then mapped to a plain internal shape that the rest of the code trusts by construction. |
| [naming](lenses/naming.md) | This lens defends **names as the documentation**: identifiers, file names, and folder names must carry the meaning, so the codebase needs no prose to explain itself. |
| [errors-as-data](lenses/errors-as-data.md) | This lens defends **error totality and throw discipline**: the idea that a fallible operation declares its failure modes in its return type rather than escaping through exceptions, and that exceptions are confined to a closed, named set of contexts. |
| [clean-architecture](lenses/clean-architecture.md) | This lens defends **structural-semantic boundaries**: the directions data and dependencies are allowed to flow, and the classification of the data that crosses the outermost edge. |
| [function-first](lenses/function-first.md) | This lens defends **function-first composition**: the idea that behaviour is expressed as functions and closures rather than authored classes, that iteration is functional transformation rather than imperative loop shape, that third-party libraries are reached only through a confined wrapping boundary, and that every authored function takes a single named-field argument rather than a positional list. |
| [di-discipline](lenses/di-discipline.md) | This lens defends **dependency injection through composition** on both faces of the code: every technical binding a unit needs — wall-clock time, process and signal lifecycle, standard-library capabilities (filesystem, crypto, path, net), and third-party services — arrives through a named port the unit receives as a constructor parameter or function argument, never reached for through a global, an ambient import, or the module system. |
| [test-discipline](lenses/test-discipline.md) | This lens defends **structural test discipline** as a load-bearing floor — the shape of the test suite, not the truth of any domain assertion. |
| [decomposition](lenses/decomposition.md) | This lens audits **shape, not content** — it asks whether a unit is doing more than its altitude warrants. |
| [defended-on-intent](lenses/defended-on-intent.md) | This lens defends **intent over letter**: a PASS is only a PASS when the artefact satisfies both the literal text of the cited rule *and* the principle that rule exists to encode. |

The defended-on-intent lens runs last, over the other lenses' findings.
