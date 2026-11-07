# Recommended setup — friction reducers the plugin cannot install for you

These are **optional**. The pipeline works without them; each removes a specific, recurring friction that AIDLC's own file formats create once more than one lane runs concurrently.

They live here rather than in the plugin's installed surface because each writes to a place a plugin has no business writing to — your git config, your repository attributes, your package scripts. **You install them deliberately, or not at all.**

Everything below relates to AIDLC's own workspace files. Nothing here is about any particular project's code.

---

## 1. Merge drivers for the two AIDLC files that conflict by construction

### The problem

Two AIDLC workspace files are **append-heavy and written by every lane**, so any two branches that both did pipeline work conflict on them — not because of disagreement, but because both appended:

| File | Why it conflicts |
|---|---|
| `aidlc/spaces/*/intents/*/audit/*.md` | Each gate appends an audit event. Two lanes running different intents both append to their own shards; two lanes touching the same intent append to the same one. Git sees adjacent additions and refuses. |
| `aidlc/spaces/*/intents/intents.json` | The intent registry. Every promotion adds a row. Two lanes promoting different intents produce two different one-row additions to the same array. |

Neither conflict is semantic. In both cases the correct resolution is a **union** — but git cannot know that, so it hands you a conflict marker in a file no human authored.

Left unmanaged this is the dominant conflict source in a concurrent pipeline: the two files nobody edits by hand are the two that always collide.

### The resolution

Both merges are **deterministic**, which is what makes a driver appropriate rather than a heuristic:

- **Audit shards** — a timestamp-ordered dedup union. Events carry their own timestamps; the union is every event from both sides, ordered, with exact duplicates collapsed. Order is total and duplicates are identifiable, so there is one right answer.
- **Intents registry** — a uuid-keyed three-way union. Each row has a stable id; a three-way merge against the base distinguishes *added on one side* from *removed on the other*, which a two-way union cannot.

### Installing

Two halves. Both are required — either alone does nothing.

**Half one — declare which paths use which driver.** In your repository's `.gitattributes`:

```gitattributes
aidlc/spaces/*/intents/*/audit/*.md    merge=<audit-shard-driver-name>
aidlc/spaces/*/intents/intents.json    merge=<intents-registry-driver-name>
```

This half is **committed and shared**. It is also inert on its own: git resolves a `merge=<name>` attribute against local config, and if no such driver is configured it falls back to the default merge. So a clone that has not installed half two behaves exactly as it did before — **conflicts, rather than breakage**. That fallback is the property that makes shipping half one safe.

**Half two — configure the drivers locally.** Per clone, in git config:

```
merge.<audit-shard-driver-name>.name       = timestamp-ordered dedup union of two audit shards
merge.<audit-shard-driver-name>.driver     = <your-shard-merge-command> --path %P --ours %A --theirs %B --out %A

merge.<intents-registry-driver-name>.name   = uuid-keyed three-way union of the intents registry
merge.<intents-registry-driver-name>.driver = <your-registry-merge-command> --base %O --ours %A --theirs %B --out %A
```

Git substitutes `%O` (base), `%A` (ours — **also the output path**), `%B` (theirs), `%P` (the pathname). Note the shard driver takes no `%O`: a union of two append-only logs needs no base, while the registry's add-vs-remove distinction does.

**Write to the git common dir, not the worktree config.** One run then covers every worktree of the clone. This matters if you use worktrees per lane — which a concurrent pipeline generally does, which is the same reason you need the drivers.

### Caveats worth knowing before you install

- A merge driver runs **arbitrary code during a merge**. Whoever installs half two is trusting the command. That is precisely why half two is a deliberate local action and not something a plugin writes for you.
- The driver must be **idempotent and total**: it will be invoked during rebases and cherry-picks, not only merges, and a driver that fails leaves the conflict in place. Failing loudly is correct; failing silently and writing a half-merge is not.
- Nothing invokes half two automatically. If you want it wired into worktree provisioning, that is your setup's job — and it is worth doing, because a driver installed on one clone and not another produces confusing asymmetry.

---

## 2. Ignore the derived, commit the authored

AIDLC's workspace mixes **authored source**, **committed record**, and **derived output** in one tree. Getting the boundary wrong causes two opposite frictions, both common:

| Kind | Examples | Treatment |
|---|---|---|
| Authored | memory layers, knowledge, plugin content | commit |
| Record | intent record dirs, audit shards, the intents registry | commit — this is the system of record |
| Derived | any built distribution, compiled graphs, status projections | **ignore** |
| Per-clone runtime | active-intent cursors, clone tokens, session scratch | **ignore** |

**A committed derived file is worse than no file.** Every lane regenerates it wholly, so any two lanes conflict on it — and it goes stale the instant another lane advances anything, which is exactly when it is most likely to be read as authoritative. If a file is reconstructible by a command every run already executes, ignore it and let each run rebuild it.

**A per-clone cursor must never be committed.** It records where *this checkout* is pointing. Committed, it fights every other clone and silently repoints sessions.

The mirror-image failure is ignoring something authored — most often a record dir, because it sits under the same root as derived output. The record is the system of record; losing it loses the pipeline's memory.

---

## 3. Attribute the identities the pipeline acts as

If you configure distinct `authorIdentity` and `reviewerIdentity` (see [ADOPTING.md](ADOPTING.md) §1), git needs to know which one is committing.

Configure the authoring identity **per worktree** rather than globally, so that:

- agent work is attributed to the authoring identity;
- your own commits from your primary checkout stay attributed to you.

The review gate rests on the forge refusing to let an actor approve its own pull request, so the two identities must be genuinely distinct at the forge, not merely different strings. The plugin validates that they differ; it cannot validate that your forge treats them as different actors.

---

## 4. A linter config that enforces the deterministic half of the constitution

The code-discipline rules split into two halves. The judgement half reaches you through the review lenses. The **deterministic** half — no `any` (CD-1), no non-null assertions and no casts outside the closed list (CD-2), no authored classes (CD-14), no `for…in` (CD-15), no `default:` on a closed union (CD-8), single-object arguments (CD-45), no enums, no namespaces, no parameter reassignment — is ordinary linting, and without a linter config nothing checks it.

The plugin ships one at `{{HARNESS_DIR}}/knowledge/rin-gates/biome.default.json`. Copy it to `biome.json` at your project root and install biome. It is a starting point you own from that moment, not a managed file.

**It excludes the installed harness and `plugins/` deliberately.** That content is the plugin's, not yours: it is written to a wire format your conventions do not govern, and linting someone else's vendored code produces findings you cannot act on. Your linter should govern your code. This mirrors what rin does with its own vendored tree.

Verify both halves after copying it — that it catches a violation in your own source, and that it stays quiet on the installed tree:

```
biome ci src
biome ci .
```

The first should flag a file you deliberately write with `any` in it. The second should check only your files.

Two settings will not survive contact with a real project. `noMagicNumbers` and `useMaxParams` (max 2) are strict, and a codebase that has not been written against them from the start will produce a lot of noise; turn them to `"off"` and reintroduce them per-directory if you want them. `useFilenamingConvention` assumes kebab-case, which is a convention rather than a rule — change it to match yours.

## What this file is not

It is not a list of commands to run. Every recommendation here names an **operation and its contract** — the same convention the plugin's prose uses — because the command is yours: your package manager, your script names, your git config location.

If you want the operations themselves, they are the two merge tools the plugin ships. Bind them to your own script names and put those names in the driver config above.
