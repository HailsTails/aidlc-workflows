# Process Discipline — PD-1

PD-1 is binding rule text, cited by id at review the way CD and DD rules are. Its `status:` frontmatter carries its standing. Every dispatched agent loads this directory, and every one of them applies these rules as its own: read each rule in full before you act.

## Reading rules

Identical to the CD and DD sets. **Soft qualifiers (`preferred`, `sparingly`, `well-justified`, `trivial`, `where readability is equal`) do not appear in rule text**: if a clause does not name an exact closed condition, it has no exception. Cite findings and push-backs by `PD-N` pointing at these files, never at a summary of them.

## The rules

| id | rule | enforced by |
|---|---|---|
| [PD-1](pd-001-obligations-are-weighed-against-ordinary-use.md) | An obligation is owed only if the customer's ordinary use reaches it | judgement: every dispatched agent, and the review board |

## Doing work

Never add, request or report as owed a code path, test, fixture, check or kept artefact that `PD-1` does not owe.

## Reviewing

Before raising a finding whose remedy is an obligation as `PD-1` defines it, ask whether `PD-1` owes that obligation. When it does not, the finding is non-blocking, and you list it disposed, as one line in your `## Verdict` region in exactly this shape, in place of the finding's usual citation:

| <file:line> <the demand> | push-back(PD-1 — <why PD-1 does not owe it>) | why-chain: 1. Why <question>? Because <answer> (<evidence>) 2. Why <question>? Because <answer> (<evidence>) 3. Why <question>? Because <answer> (<evidence>) 4. Why <question>? Because <answer> (<evidence>) 5. root cause: PD-1 condition <n>: <cause> owner: <owner> (<evidence>) |

Write the line bare, without backticks. It has a leading pipe and exactly three cells, so no cell contains a `|` of its own. The reason inside `push-back(…)` contains none of the characters `(`, `)`, `:` and `@`, so no word in it is counted as a second disposition. In the chain cell, a number followed by a full stop and a space appears only as the five step numbers, and a parenthesis appears only as each step's one evidence parenthesis, which ends its step. Every answer, and the root cause, is at least twelve characters. Every evidence parenthesis holds at least four characters: a command and its output, a `file:line`, a record id or a named ruling, with a facts key cited with its file (`facts.md N-1`), never bare. The root cause opens with `PD-1 condition <n>:`, naming the condition of `PD-1` under which the obligation is not owed, and then names the cause. In the chain cell the word `owner` appears only as the step-5 label. The owner contains no full stop: a record id, a capture id or a person, never a file path. A disposed line does not block, so a READY verdict may list it; when your verdict is READY, never write the word NOT directly before READY in that region, in any case, whether joined by a space, a hyphen, an underscore or nothing.
