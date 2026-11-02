# The why-chain contract

A why-chain explains why an exception is needed. It starts at the symptom, which is the exception itself, and traces cause to cause until it reaches a root that someone owns. Every new or edited `whyChain` in `discipline-exceptions.json` follows this contract, and core refuses one that breaks a mechanical rule; a chain written before it is handled as [below](#chains-written-to-the-earlier-contract). Rin's DD-7 and R7 point here for the chain's shape.

The contract keeps exactly five whys. What it fixes is the shape of the chain. A chain that lists five objections ("why not X?", "why only this file?") or restates one reason five times is not a chain: each why must ask why the answer before it is true.

## Shape

```json
"whyChain": {
  "whys": [
    { "why": "Why does the audit refuse tracker ids in carve-out names?", "because": "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.", "evidence": "tools/audit/name-matcher.ts:14" },
    { "why": "Why does the name matcher accept only lowercase slugs?", "because": "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.", "evidence": "tools/git/branch-name.ts:8" },
    { "why": "Why was the matcher copied from the branch-name validator?", "because": "No shared slug type existed when the audit landed, so each tool wrote its own pattern.", "evidence": "PR #212, merged 2026-07-02" },
    { "why": "Why did no shared slug type exist when the audit landed?", "because": "The values package that now holds RepoPath was split out two months after the audit.", "evidence": "packages/values/package.json:3" },
    { "why": "Why was the values package split out after the audit?", "because": "The split waited on the monorepo move, which left older tools on their own patterns.", "evidence": "docs/decisions/0007-monorepo.md:21" }
  ],
  "rootCause": "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  "rootCheck": "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  "readback": "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  "owner": "capture 01a0b421"
}
```

| Field | What it holds |
|---|---|
| `whys` | Exactly five steps. Why 1 asks about the symptom. Each later `why` asks why the previous `because` is true, and names what that answer said. |
| `because` | The cause, with something new in it: a cause, not the previous answer in other words. |
| `evidence` | Where the cause can be checked again: a path, a line, a record or PR number, a measurement or a link. |
| `rootCause` | The cause behind the fifth answer: a found fact or an owned decision, never a symptom or a restatement such as "no time" or "out of scope". |
| `rootCheck` | What you ran or read today that shows the root still holds, and what it showed, with a path, record, measurement or link. |
| `readback` | The chain read from the root back to the symptom, joined with "therefore". |
| `owner` | Who owns the root: a record, a capture id, or the holder of the reserved authority. |

`rootCheck` and `readback` are a pair. A chain that has either one is a causal chain and needs both.

## What core checks

These checks work on the words of the chain. Core lowercases the text, splits camelCase identifiers and paths into words, and drops function words (articles, pronouns, possessives, prepositions and common adverbs), words under three letters and bare numbers. It then reduces inflections to a crude stem, so "copied" and "copies" match. The stem is crude: a few pairs still split ("agree" and "agreed") and a few unrelated words meet ("plan" and "plane"). It uses no language model.

1. **Five steps, each answered.** Core keeps the earlier floor: exactly five whys, a non-blank `why`, a `because` and `evidence` of at least 12 characters that are not one repeated character, a `rootCause` that does not open with a stock restatement, and an `owner`.
2. **Evidence can be checked again.** Every `evidence` and the `rootCheck` must hold a path (`a/b`), a file name, a link, or a number. A file name starts a word and ends in a lowercase extension of one to ten letters or digits (`name.ext`, `vitest.config.ts`, `*.fixture.ts`), or is a dotfile (`.gitignore`); a name with no extension, such as `Makefile`, needs its path. Prose such as "the redirects documentation" is refused, and "e.g.", "i.e.", "a.k.a.", "etc.", "a.m.", "p.m.", and a standalone "and/or", "n/a", "w/o" or "yes/no" don't count. This is a floor: any path-shaped word passes, whether or not it points at the cause.
3. **Each answer introduces a cause.** An answer's new words are the words that appear in neither why 1's question nor any earlier answer. An answer whose new words are fewer than a quarter of its content words restates the symptom or an earlier answer, and is refused. When this was set, every answer in the pilot's chains brought in at least a third new words, 4 of 496 later answers in one consumer's file fell below a quarter (each repeating the answers before it), and a chain restating one reason fell below it by its third answer.
4. **Each why asks about the previous answer.** Why 1 must name the symptom in at least one content word. Why 2 to why 5 must each use at least one of the previous answer's new words. A question that only reuses the symptom's words, or names its subject by pronoun ("why is that enough?"), is refused, and the refusal lists the words it could have named.
5. **The root is the fifth answer's cause.** `rootCause` must use at least one of the fifth answer's new words.
6. **The readback runs from root to symptom.** `readback` must contain "therefore", use at least one word of `rootCause`, and use at least two words of why 1's question (all of them when it has fewer).

A refusal names the step and what to fix. With why 3 of the example above changed to "Why is that enough?", the report lists:

```text
exceptions[0] why-chain-refused ✖ does not ask about the cause why 2's answer gave: ask why that answer is true, naming its cause (copied, branch, validator, git, refs, fold, case, windows)\n  → at whys[2].why
```

## What the review lenses still judge

The checks catch a chain's shape, not whether it is true. A chain can pass every check and still be wrong. Reviewers judge:

- whether each answer is true, and whether its evidence supports it;
- whether each link is a real cause, not an objection that happens to reuse a word from the previous answer ("Why is a recorded check enough?" after an answer that mentions a check passes check 4 and is still an objection);
- whether the root is the right root: if the root changed, the exception would no longer be needed;
- whether the `rootCheck` really tests today's state, rather than citing a path that has nothing to do with the root;
- whether a rule is being used as a cause. A rule is the test the chain is judged by, not a reason inside it;
- whether an answer with more than one cause follows each one, or says why a branch carries no weight;
- a restatement in different words. Check 3 catches an answer that mostly reuses earlier words; one reworded in fresh synonyms passes it.

## Chains written to the earlier contract

A chain with neither `rootCheck` nor `readback` is a legacy chain, written before this contract. It is judged against `--base-revision`, the same way imported records are:

- **Unchanged since the base revision:** judged by the earlier floor (check 1 only), and accepted when it passes. Reordering keys inside the chain counts as an edit.
- **New or edited since the base revision:** judged by this contract and refused until it is rewritten. The refusal says so.
- **No base revision, or git cannot read the base:** the record is judged by the earlier floor and accepted when it passes, and the run reports `legacy-chain-unmeasured`, which fails the verdict. Pass `--base-revision`, or rewrite every legacy chain.
- **A base whose `discipline-exceptions.json` does not parse:** the base holds no entries, so every legacy chain counts as new and is refused.
- **The `project` command** reads no base revision. It projects legacy chains as it always did, and reports nothing about them.

This grace period has no end date. A legacy chain stays accepted until its entry is touched, so a repository that wants every chain causal rewrites them on purpose. Section 8 of `MIGRATING.md` in the discipline-core source gives the steps.
