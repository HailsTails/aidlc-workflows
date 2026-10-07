// PreToolUse path guard for the rin-gates review-verdict artefact.
//
// Root cause addressed (Gate-5 review B1, 2026-07-13): the autonomy backstop
// hook (rin-gates-autonomy-gate.ts) refuses an autonomous `report
// --result approved` unless a `review-verdict.json` with verdict:"READY" exists
// for the gate. But if that file is freely model-writable, an autonomous lane
// can FABRICATE its own READY verdict and sail through — the "decorrelated
// review must happen" is unenforced prose. This guard closes that hole exactly
// as rin-gates-receipt-guard.ts closes the receipt-forgery hole: it makes
// `review-verdict.json` TOOL-WRITABLE-ONLY.
//
// The ONLY legitimate writer is rin-gates-review-verdict.ts (the emitter that
// runs / attests the decorrelated review and binds the verdict to the reviewed
// diff). This guard denies any Write/Edit/MultiEdit/Bash that targets a
// `review-verdict.json` path — the emitter writes via the same
// RIN_GATES_VERDICT_EMITTER token the tool sets in its own process env, which a
// hand `Write` cannot carry. A fabricated verdict is therefore refused.
//
// COUPLING (Gate-5 re-review L2): this guard's Bash arm matches a mutating shell
// construct NAMING review-verdict.json. The interpreter route — `node -e` /
// `bun -e` / heredoc-fed python writing the file with no shell mutator near the
// path — is NOT caught here; it is blocked by the sibling `block-inline-exec` /
// `rin-guard-inline-exec` hook (deny of -e/-c/heredoc/pipe-into-interpreter).
// The two hooks defend the verdict as a PAIR: if the inline-exec deny is ever
// weakened, re-add an interpreter-write matcher here. The autonomy hook's
// emittedBy + fresh-headSha checks are the third layer that catches anything
// that still reaches disk unstamped.
//
// DELETION IS NOT FABRICATION. The invariant this guard
// protects is "a READY verdict may only be produced by the emitter" — an
// authorisation must not be manufacturable by hand. Removing a verdict manufactures
// nothing: after a delete the gate still demands a real emitted READY, so the lane
// is strictly worse off, never better. Denying deletion bought no safety and
// created permanently-unfixable strandage — main's a04de75a slug migration retired
// the bare `gate-N-*` verdict path, and any verdict authored after that sweep was
// left at a path no sanctioned tool could clear (task 019fa8ba-11b2). So a pure
// delete naming ONLY verdict paths is allowed.
//
// `mv` and `cp` stay DENIED even though they remove from a source: they also WRITE
// a verdict at a destination, which is exactly the fabrication route (V6 covers the
// rename evasion). Only genuinely-destructive-with-no-write verbs are permitted.
//
// SCOPE OF "STRICTLY WORSE OFF" (PR #384 review B2). That claim holds for the
// verdict FILE only. The scribe's accumulation jsonl is a different matter: it
// carries the anyNotReady poison, so wiping it WOULD let a lane re-roll a board
// that already returned NOT-READY at the same headSha. The accumulation is
// therefore denied to every mutating command, deletion included (V17) — the
// allowance clears a stale verdict, never a blocking finding.
//
// KNOWN GAP (019fa8cf-faf4, pre-existing): both arms below gate on the LITERAL
// string `review-verdict.json`, so a glob or directory-destination operand is
// invisible to this guard entirely. V14 pins the current behaviour so a fix flips
// it loudly. The inline-exec deny and the autonomy gate's emittedBy + fresh-headSha
// checks are the defence-in-depth meanwhile.

// Deny = exit 2 + stderr (PreToolUse deny convention). Allow = exit 0.

// PATH-SEGMENT ANCHORING (task 01a02ba0). The protected OBJECT is a file NAMED
// `review-verdict.json` — not any filename that happens to END with that string.
// An unanchored `…json$` also matched `sample-review-verdict.json` and
// `fake-review-verdict.json`, so documentation examples and test fixtures were
// unwritable. An over-block IS the
// defect; this is the same precision move as the operand quote-stripping and the
// backslash-removed-from-the-veto precedents (pipeline decisions, 2026-07-28) —
// a NARROWING that makes the matcher name the object it was always meant to name.
// Requiring a separator (or string start) immediately before the filename cannot
// admit a single new write: every path that previously matched as a whole
// FILENAME still matches, and only the strictly-larger names it never protected
// are released.
// Anchoring within a whole COMMAND string cannot use `^`, because the operand sits
// mid-command. The equivalent test there is "no filename character immediately
// precedes the name": a separator, whitespace, a quote, or a shell operator may,
// but a word character, `.`, `-` or `_` may not — those would make the name a
// SUFFIX of a larger filename rather than the filename itself.
const VERDICT_FILE = /(?:^|[\\/])review-verdict\.json$/i;
const VERDICT_PATH_IN_COMMAND = /(?:^|[^\w.-])review-verdict\.json/i;
// The scribe's per-{record,gate,headSha} accumulation carries each lens's
// STANDING refusal at that HEAD. A refusal is retired only by that same lens
// reporting again at the same HEAD with a sha-echoing READY (task 019fef05) —
// a review, never an erasure, and never by another lens. Wiping the file would
// convert "this commit is blocked by a finding" into "re-roll the board until
// green at the same commit", so the accumulation is guarded exactly like the
// verdict — including against the deletion allowance below.
//
// Anchored as a whole path SEGMENT for the same reason as the verdict filename
// (task 01a02ba0): unanchored at both ends it also matched
// `docs/.rin-gates-review-captures-notes.md`, a note ABOUT the accumulation
// rather than the accumulation itself. The directory must be followed by a
// separator or end the operand, and preceded by a separator or the operand start.
const CAPTURES_PATH_IN_FILE_PATH =
  /(?:^|[\\/])\.rin-gates-review-captures(?:[\\/]|$)/i;
const CAPTURES_PATH_IN_COMMAND =
  /(?:^|[^\w.-])\.rin-gates-review-captures(?:[\\/]|[^\w.-]|$)/i;
// A cheap substring pre-filter only — never an identity test. It exists so the
// common command carries no anchored-regex cost, and every positive it produces
// is re-tested by the anchored pattern above.
const CAPTURES_SUBSTRING = /\.rin-gates-review-captures/i;
const FD_ONLY_REDIRECT = /\d*>>?\s*(?:\/dev\/null|nul)\b|\d*>&\d+/gi;
const MUTATING_SHELL =
  /(>>?|\btee\b|\bcp\b|\bmv\b|\binstall\b|\btruncate\b|\brm\b|\bsed\b\s+[^\n|;&]*-i|\bdd\b)/i;
const DELETE_VERB = /\b(?:rm|unlink)\b/i;
const WRITING_SHELL =
  /(>>?|\btee\b|\bcp\b|\bmv\b|\binstall\b|\btruncate\b|\bsed\b\s+[^\n|;&]*-i|\bdd\b)/i;
const DELETION_WORD = /^(?:git|rm|unlink|-{1,2}[\w-]*)$/i;
const SHELL_METACHARACTER = /[;&|`$(){}<>*?[\]~!'"]/;

type HookInput = {
  readonly tool_name?: string;
  readonly tool_input?: {
    readonly file_path?: string;
    readonly command?: string;
  };
};

const readStdin = (): Promise<string> =>
  new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
  });

const deny = (reason: string): never => {
  process.stderr.write(reason);
  process.exit(2);
};

// Quoting a path is a shell-neutral spelling of the same operand, so the
// deletion allowance must read `rm "<verdict>"` exactly as it reads
// `rm <verdict>`. Both the filename match (anchored on $, which a trailing
// quote defeats) and the metacharacter veto (' and " are themselves listed
// metacharacters) previously rejected the quoted spelling, sending a legitimate
// deletion into the fabrication-deny branch. That is the defect this strips.
//
// Only a BALANCED pair wrapping the WHOLE operand is removed, and only quote
// characters are removed. An operand whose quotes wrap a substring
// (`rm x"; curl evil"`) keeps its metacharacters and still fails the veto, so
// quoting cannot launder an injection into the allowance.
const stripSurroundingQuotes = (word: string): string =>
  word.replace(/^(['"])(.*)\1$/s, "$2");

const stripBalancedOperandQuotes = (command: string): string =>
  command.trim().split(/\s+/).map(stripSurroundingQuotes).join(" ");

const everyOperandIsAVerdict = (command: string): boolean => {
  const words = command.trim().split(/\s+/).map(stripSurroundingQuotes);
  const operands = words.filter((word) => !DELETION_WORD.test(word));
  if (operands.length === 0) return false;
  return operands.every((operand) => VERDICT_FILE.test(operand));
};

const isPureVerdictDeletion = (command: string): boolean => {
  if (!DELETE_VERB.test(command)) return false;
  if (WRITING_SHELL.test(command)) return false;
  if (SHELL_METACHARACTER.test(stripBalancedOperandQuotes(command))) {
    return false;
  }
  return everyOperandIsAVerdict(command);
};

// OVER-BLOCK FIX (task 019fd9b0). The predicates below scan the WHOLE command
// string, so a `git commit` whose MESSAGE merely NAMES the guarded file was read
// as a write — the deny fired on prose describing the guard, with nothing in the
// tree or the staged diff touching the path. An over-block IS the
// defect: over-blocking and under-blocking are
// the same class of matcher defect. The cost compounds, because the one moment a
// session most needs to explain the verdict mechanism in a commit message is when
// a gate is blocked on it — exactly when the guard fires — and it teaches sessions
// to route prose around the matcher, the habit the inline-exec rails suppress.
//
// The fix is PRECISION, never weakening: a QUOTED message argument to `git commit`
// -m/-am/-F, plus a heredoc body, is removed before the write-detection predicates
// run. Everything else in the command is scanned exactly as before.
//
// WHY THIS IS NOT RECOMPOSABLE INTO A WRITE CHANNEL (the security argument this
// change must make, #389 standard). Three independent properties, each sufficient:
//
//  1. ONLY A BALANCED QUOTED LITERAL IS REMOVED. The regexes match a quote, a body
//     containing no unescaped quote of the same kind, and the closing quote. Under
//     real shell semantics that span is EXACTLY the single argument the shell hands
//     to git as the message — it cannot contain an unquoted `>`, `;`, `&&`, or `|`
//     that the shell would act on, because those characters are literal inside the
//     quotes. Removing it therefore removes no executable syntax.
//  2. A `$(...)` OR BACKTICK SUBSTITUTION IS NOT REMOVED. Command substitution DOES
//     execute inside double quotes, so a message containing one is left in place
//     and scanned — `git commit -m "$(echo x > verdict)"` still denies.
//  3. THE EXEMPTION IS VERB-GATED. It applies only when the command's leading verb
//     is `git commit`. A chained write is not part of the message argument, so
//     `git commit -m "note" && echo x > verdict` keeps its tail and still denies.
//
// The bar this change is held to: every construct in the guard's own selftest
// (V8–V17) and every case in the sibling deny suites must still deny, while a
// commit whose message merely names the file is allowed.
const COMMIT_VERB = /^\s*git\s+commit\b/;
const SUBSTITUTION = /\$\(|`/;
// A balanced quoted literal following the message flag. The body excludes the
// same quote character (so the match ends at the true closing quote) and allows a
// backslash-escaped one.
const DOUBLE_QUOTED_MESSAGE = /(-m|-am|-F)\s+"(?:[^"\\]|\\.)*"/g;
const SINGLE_QUOTED_MESSAGE = /(-m|-am|-F)\s+'(?:[^'\\]|\\.)*'/g;
// A heredoc body: everything between the delimiter and its terminating line. The
// shell treats this as literal data delivered on stdin, not as command syntax.
const HEREDOC_BODY = /<<-?\s*(['"]?)(\w+)\1[\s\S]*?^\s*\2\s*$/gm;

// CONTEXT-AWARE SUBSTITUTION FALLBACK (task 01a02632). The fallback below used to
// test SUBSTITUTION against the WHOLE ORIGINAL command, so a single backtick
// ANYWHERE — including inside a single-quoted message, where no shell on earth
// evaluates it — discarded the stripped result and re-enabled full-message
// scanning. A session documenting the mechanism in prose (`git commit -m 'the
// `.rin-gates-review-captures` accumulation stayed empty'`) was denied for writing
// a sentence. Same over-block class as the anchoring defect above, and the same
// remedy as the operand quote-stripping precedent: read the operand the way the
// SHELL reads it rather than the way a substring search does.
//
// The fix tests SUBSTITUTION against the RESIDUE — what the shell would actually
// evaluate — rather than the original. Stripping is by QUOTE KIND, because the two
// kinds have different shell semantics:
//
//  - A SINGLE-quoted span is fully inert. No expansion of any sort occurs inside
//    it, so its contents can never become executable syntax and it is always
//    strippable.
//  - A DOUBLE-quoted span DOES evaluate `$(…)` and backticks. Such a span is
//    therefore NOT stripped: it stays in the residue, SUBSTITUTION finds it, and
//    the whole original command is scanned — `git commit -m "note `echo x >
//    VERDICT`"` still denies, exactly as before.
//
// WHY THIS CANNOT BECOME A WRITE CHANNEL. Stripping is still confined to a
// BALANCED quoted literal following a message flag on a command whose leading verb
// is `git commit` (all three properties from the block above are unchanged). The
// only behaviour that changes is WHICH command text the substitution test reads,
// and it now reads strictly MORE faithfully: every span removed before the test is
// a span the shell provably cannot execute. A backtick or `$(` that survives
// stripping — chained after the message, inside a double-quoted span, or anywhere
// outside a message argument — still forces the whole-command scan.
//
// A heredoc whose delimiter is QUOTED (`<<'EOF'`) suppresses every expansion in
// the body, exactly like a single-quoted span — so its body is inert and drops out
// of the residue. An UNQUOTED delimiter (`<<EOF`) DOES expand, so its body stays in
// the residue and any substitution it carries still forces the whole-command scan.
// That is the conservative handling the existing "substitution smuggled inside a
// heredoc body" deny row depends on, preserved by construction.
const QUOTED_DELIMITER_HEREDOC_BODY =
  /<<-?\s*(['"])(\w+)\1[\s\S]*?^\s*\2\s*$/gm;
const SINGLE_QUOTED_MESSAGE_BODY = /(-m|-am|-F)\s+'(?:[^'\\]|\\.)*'/g;
const DOUBLE_QUOTED_MESSAGE_BODY = /(-m|-am|-F)\s+"((?:[^"\\]|\\.)*)"/g;

// A backtick or `$(` inside DOUBLE quotes is evaluated by the shell, so such a
// span is not inert and is deliberately left in the residue — it must keep forcing
// the whole-command scan. Only an escaped one (`\``) is inert, and SUBSTITUTION
// does not match the escape sequence.
const isInertDoubleQuotedBody = (body: string): boolean =>
  !SUBSTITUTION.test(body.replace(/\\./g, " "));

const strippedForSubstitutionTest = (command: string): string =>
  command
    .replace(QUOTED_DELIMITER_HEREDOC_BODY, " ")
    .replace(SINGLE_QUOTED_MESSAGE_BODY, "$1 ")
    .replace(
      DOUBLE_QUOTED_MESSAGE_BODY,
      (whole: string, flag: string, body: string) =>
        isInertDoubleQuotedBody(body) ? `${flag} ` : whole,
    );

const withoutCommitMessages = (command: string): string => {
  if (!COMMIT_VERB.test(command)) return command;
  // HEREDOC_BODY strips BOTH delimiter kinds for the write-detection scan. The
  // delimiter distinction is drawn in the residue instead, where it decides
  // execution: only a QUOTED-delimiter body drops out there, so an unquoted-
  // delimiter heredoc carrying a substitution still forces the whole-command scan.
  const withoutHeredoc = command.replace(HEREDOC_BODY, " ");
  const stripped = withoutHeredoc
    .replace(DOUBLE_QUOTED_MESSAGE, "$1 ")
    .replace(SINGLE_QUOTED_MESSAGE, "$1 ");
  const residue = strippedForSubstitutionTest(command);
  return SUBSTITUTION.test(residue) ? command : stripped;
};

const touchesVerdict = (input: HookInput): boolean => {
  const filePath = input.tool_input?.file_path ?? "";
  if (VERDICT_FILE.test(filePath)) return true;
  if (CAPTURES_PATH_IN_FILE_PATH.test(filePath)) return true;
  const command = input.tool_input?.command ?? "";
  const withoutFdRedirects = withoutCommitMessages(
    command.replace(FD_ONLY_REDIRECT, " "),
  );
  if (
    CAPTURES_SUBSTRING.test(withoutFdRedirects) &&
    CAPTURES_PATH_IN_COMMAND.test(withoutFdRedirects)
  ) {
    return MUTATING_SHELL.test(withoutFdRedirects);
  }
  if (!VERDICT_PATH_IN_COMMAND.test(withoutFdRedirects)) return false;
  if (isPureVerdictDeletion(withoutFdRedirects)) return false;
  return MUTATING_SHELL.test(withoutFdRedirects);
};

const main = async (): Promise<void> => {
  const raw = await readStdin();
  if (raw.trim() === "") process.exit(0);

  let input: HookInput;
  try {
    input = JSON.parse(raw) as HookInput;
  } catch {
    process.exit(0);
  }

  if (!touchesVerdict(input)) process.exit(0);

  deny(
    "Blocked: review-verdict.json is tool-writable-only. A rin-gates gate " +
      "review verdict is emitted by `pnpm rin-gates:review-verdict` (which runs " +
      "or attests the decorrelated review and binds the verdict to the reviewed " +
      "diff) — never by a hand Write/Edit/redirect. A hand-written verdict would " +
      "let an autonomous lane rubber-stamp its own gate (Gate-5 review B1) and is " +
      "refused. Run the review emitter to record a real verdict. The scribe's " +
      ".rin-gates-review-captures accumulation is guarded the same way: it carries " +
      "each lens's standing refusal, which only that same lens can retire by " +
      "reviewing again at the same HEAD — never by erasing the record.\n",
  );
};

main().catch(() => process.exit(0));

export {};
