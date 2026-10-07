---
lens: [naming]
fuelled-by: code-discipline rules tagged `lens: naming`
---

# Naming lens

A reusable audit method, not a ruleset. The rules it enforces are **data**: load
every `code-discipline/cd-*.md` whose frontmatter carries `lens: naming` from the
codebase under review and treat their text as authoritative. This file describes
only *how* the lens reads code — the concept, the inspection procedure, and the
output shape. It names no specific rule numbers, file paths, type names, or tool
names; those live in the loaded rules and differ per codebase.

## Concept

This lens defends **names as the documentation**: identifiers, file names, and
folder names must carry the meaning, so the codebase needs no prose to explain
itself. It has three intertwined strands:

- **Identifier meaning.** Every binding site names what it holds. Shorthand and
  single-letter names (a loop index, a one-letter callback parameter) and filler
  words (the generic "data", "value", "result", "info", "params" family) are
  banned because they push the meaning off the page. A short scope is no excuse —
  a reduce-callback parameter or a tuple destructure carries meaning the same way
  a top-level declaration does. Filler words are typically rescued by a
  domain-prefixed compound (the prefix carries the meaning the suffix lacks),
  while shorthand usually has no rescue at all.
- **No comments.** Prose comments and doc-comment blocks are banned outright;
  only a closed set of machine-meaningful annotations (a tracked TODO, a
  tool-suppression directive) is permitted, and each carries a mandatory tracker
  reference so every escape hatch is owned by a spec or issue.
- **File and folder names.** Files and folders are named for the abstraction they
  contain, never for a category. A categorical name (the "utils / helpers /
  common / types / misc" family) is the smell of a *missing primitive* — the
  abstraction those contents share has not been found and named. A re-export
  grab-bag barrel sits in the same family.

Across codebases the concept recurs under different names (a style guide's
"intention-revealing names", a "no junk-drawer modules" rule, a "self-documenting
code" principle). The loaded rules tell you this codebase's exact lists: which
shorthand and filler tokens are banned, what domain-prefix carve-out exists, which
filenames and folders are categorical, which annotation forms are permitted and
their required tracker format, and the case shape filenames must follow. Read them
first; they override any default intuition.

## Loading the ruleset

1. Resolve the codebase's code-discipline directory (the convention is
   `code-discipline/` beside the constitution; the dispatching workflow states
   the resolved path).
2. Glob `cd-*.md`. **If the directory does not exist, or the glob yields zero `cd-*.md` files at all, STOP and return CANNOT-REVIEW naming the resolved path.** That is an unloadable ruleset, never a codebase without discipline. Ensure the pinned plugin installation and its `{{HARNESS_DIR}}/knowledge/aidlc-shared/code-discipline/` directory are present in the review worktree. Reviewing zero rules would emit a PASS that means nothing. Then keep those whose frontmatter `lens:` value is `naming`.
3. Read each kept rule in full, including its `## Carve-outs` section. The
   carve-outs are the closed exception list — anything outside them is a finding.
   Carve-outs that name an exact permitted token (the single allowed
   single-character name), an exact permitted file (the one allowed barrel root),
   or a version history are load-bearing: a carve-out the active constitution
   version reinstated or reverted changes the finding count, so cite the version
   when one is in play.
4. If zero rules carry this lens tag, report that the codebase declares no naming
   discipline and produce an empty finding set — do not invent rules.

## Inspection procedure

Walk every added or renamed identifier, comment, file, and folder in the diff.

- **Shorthand / single-letter identifiers.** Check every binding site against the
  loaded shorthand list: function and lambda parameters, `const`/`let`
  declarations, destructure aliases, tuple destructures, and array-method
  callbacks (map / filter / reduce / find / every / some). Short scope is not a
  defence — a reduce accumulator or a `[k, v]` tuple is in scope. The only
  exempt single-character name is the one the carve-out names, and only when an
  external function-signature contract forces an unused positional parameter; if
  the signature is the codebase's own to change and the parameter is unused, the
  fix is to drop the parameter, not to name it with the placeholder.
- **Filler-word identifiers.** Check the same binding sites against the loaded
  filler list. A bare filler word is a finding; the rescue is the
  domain-prefixed compound the rule permits (the prefix is what carries the
  meaning). Watch the type-vs-binding distinction: a *type* named with a filler
  suffix can be fine when its prefix does the meaning-carrying work, while a
  *parameter* of that type named bare is still a finding because the call site
  loses what it is for. The domain-prefix carve-out typically covers only the
  filler category, not the shorthand category — confirm against the loaded rule.
- **Comments and annotations.** Any prose comment or doc-comment block is a
  finding. For each annotation directive (a tracked TODO, a tool-suppression
  line), check it against the closed permitted set and confirm the mandatory
  tracker reference is present and well-formed — a bare directive missing its
  tracker is a finding, and a directive form outside the permitted set (a
  non-tracked marker keyword, a suppression for a tool the codebase does not use)
  is a finding regardless of tracker.
- **Categorical filenames and folders.** Match every added/renamed file against
  the loaded forbidden-filename list and every path segment against the
  forbidden-folder list. The only permitted re-export barrel is the one site the
  rule names (the package public-surface root); any other per-folder barrel is a
  finding. When the obvious name would have been a categorical one, name the
  finding as a *missing primitive*: ask what the contents share and state the
  re-derived abstraction name as the fix.
- **Case-shape and scoped overrides.** Filenames bind to a case convention the
  rule states (a kebab/Pascal split by file kind). A name in the wrong case is a
  finding *unless* a scoped filenaming-convention override is in force for that
  path. Treat the closed list of such overrides as data alongside the rules:
  - For each override scope, glob-match it against the diff file list; a scope
    the diff touches is "in play".
  - A touched override that the spec neither narrows (drops for a now-renamed
    subset) nor retires, while it had the opportunity, is the finding — cite the
    override's recorded retirement spec/condition when one exists.
  - A newly-introduced override scope is a finding by default; it is admissible
    only with an accompanying constitution-amendment block naming a retirement
    spec or condition. An override with no retirement plan is not admissible.
  - A per-file suppression of the filenaming rule still carries the
    tracker-reference requirement — a bare one is a finding under the comment /
    annotation strand above.

For each candidate, decide finding vs non-finding strictly against the loaded
rules and their carve-outs — never against this file's prose or a remembered
version of some other codebase's rule.

## Letter-vs-intent

The lens's catch-rate lives where a name passes a superficial check but defeats
the rule: a filler word that *looks* domain-prefixed but whose prefix carries no
domain meaning; a single-character name claimed as an external-contract
placeholder that is in fact a name the author didn't think of; a file whose name
dodges the literal forbidden list yet is still a category dressed up (a "core" or
"base" junk-drawer); an override that survives untouched through the one spec that
could have retired it. A finding here must explain *how the name reads acceptable
yet the rule is defeated*, grounded in the specific loaded rule. Vague phrasings
("name is unclear", "this file is a bit of a grab-bag") are the lens's own failure
mode — name the exact banned token, the exact missing primitive, or the exact
absent tracker.

## Output shape

Produce the counts the dispatching agent mandates (e.g. shorthand identifiers,
filler-word identifiers, categorical filenames, categorical folders, untracked or
forbidden annotations, scoped overrides to narrow/retire). Every finding is
`file:line | quoted code | <rule-id> | defect-named`, citing the loaded rule by
the id its frontmatter declares and naming the expected replacement (the
domain-meaningful identifier, the re-derived abstraction filename, or the
tracker-completed annotation). State the code-discipline path you resolved and
which rule ids you loaded under this lens.
