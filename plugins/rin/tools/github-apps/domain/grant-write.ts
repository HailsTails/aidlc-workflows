import { flagTokenOf } from "./flag-token.ts";
import { fail, succeed, type Result } from "./result.ts";

type GrantFlagSpec = { readonly kind: "switch" | "valued"; readonly name: string };

type GrantFlag =
  | { readonly kind: "switch"; readonly name: string }
  | { readonly kind: "valued"; readonly name: string; readonly value: string };

const valued = (name: string): GrantFlagSpec => ({ kind: "valued", name });

const toggled = (name: string): GrantFlagSpec => ({ kind: "switch", name });

const EDIT_FLAGS: readonly (readonly [string, GrantFlagSpec])[] = [
  ["--title", valued("--title")],
  ["-t", valued("--title")],
  ["--add-label", valued("--add-label")],
  ["--remove-label", valued("--remove-label")],
  ["--add-assignee", valued("--add-assignee")],
  ["--remove-assignee", valued("--remove-assignee")],
  ["--milestone", valued("--milestone")],
  ["-m", valued("--milestone")],
  ["--remove-milestone", toggled("--remove-milestone")],
];

const PULL_REQUEST_EDIT_FLAGS: readonly (readonly [string, GrantFlagSpec])[] = [
  ["--base", valued("--base")],
  ["-B", valued("--base")],
  ["--add-reviewer", valued("--add-reviewer")],
  ["--remove-reviewer", valued("--remove-reviewer")],
];

const ISSUE_EDIT_FLAGS: readonly (readonly [string, GrantFlagSpec])[] = [
  ["--type", valued("--type")],
  ["--remove-type", toggled("--remove-type")],
  ["--remove-parent", toggled("--remove-parent")],
];

const COMMENT_FLAGS: readonly (readonly [string, GrantFlagSpec])[] = [
  ["--edit-last", toggled("--edit-last")],
  ["--create-if-none", toggled("--create-if-none")],
];

const GRANT_WRITE_FLAGS = {
  "pr edit": new Map([...EDIT_FLAGS, ...PULL_REQUEST_EDIT_FLAGS]),
  "issue edit": new Map([...EDIT_FLAGS, ...ISSUE_EDIT_FLAGS]),
  "pr comment": new Map(COMMENT_FLAGS),
  "issue comment": new Map(COMMENT_FLAGS),
} as const satisfies Readonly<Record<string, ReadonlyMap<string, GrantFlagSpec>>>;

type GrantWriteVerb = keyof typeof GRANT_WRITE_FLAGS;

type GrantWrite = {
  readonly verb: GrantWriteVerb;
  readonly target: string;
  readonly flags: readonly GrantFlag[];
  readonly files: readonly string[];
};

type GrantWriteRefusal =
  | { readonly kind: "gh-attach-target-not-number"; readonly verb: string }
  | {
      readonly kind: "gh-attach-argument-refused";
      readonly verb: GrantWriteVerb;
      readonly token: string;
    }
  | { readonly kind: "gh-flag-value-missing"; readonly flag: string };

type GrantWriteRequest = {
  readonly verb: GrantWriteVerb;
  readonly tokens: readonly string[];
  readonly files: readonly string[];
};

type GrantFlagScan = {
  readonly verb: GrantWriteVerb;
  readonly tokens: readonly string[];
  readonly flags: readonly GrantFlag[];
};

type GrantWriteCommand = { readonly write: GrantWrite; readonly body: string | undefined };

const PLAIN_NUMBER = /^[1-9]\d*$/;

const isGrantWriteVerb = (verb: string): verb is GrantWriteVerb =>
  Object.hasOwn(GRANT_WRITE_FLAGS, verb);

const acceptedGrantFlags = (verb: GrantWriteVerb): readonly string[] => [
  ...new Set([...GRANT_WRITE_FLAGS[verb].values()].map(({ name }) => name)),
];

const scanGrantFlags = ({
  verb,
  tokens,
  flags,
}: GrantFlagScan): Result<readonly GrantFlag[], GrantWriteRefusal> => {
  const [token, ...remaining] = tokens;
  if (token === undefined) return succeed(flags);
  const { flag, attachedValue } = flagTokenOf(token);
  const spec = GRANT_WRITE_FLAGS[verb].get(flag);
  if (spec === undefined) return fail({ kind: "gh-attach-argument-refused", verb, token });
  if (spec.kind === "switch") {
    if (attachedValue !== undefined) {
      return fail({ kind: "gh-attach-argument-refused", verb, token });
    }
    const toggledFlag: GrantFlag = { kind: "switch", name: spec.name };
    return scanGrantFlags({ verb, tokens: remaining, flags: [...flags, toggledFlag] });
  }
  const [followingToken, ...afterValue] = remaining;
  const value = attachedValue ?? followingToken;
  if (value === undefined) return fail({ kind: "gh-flag-value-missing", flag });
  const valuedFlag: GrantFlag = { kind: "valued", name: spec.name, value };
  return scanGrantFlags({
    verb,
    tokens: attachedValue === undefined ? afterValue : remaining,
    flags: [...flags, valuedFlag],
  });
};

const parseGrantWrite = ({
  verb,
  tokens,
  files,
}: GrantWriteRequest): Result<GrantWrite, GrantWriteRefusal> => {
  const [target, ...flagTokens] = tokens;
  if (target === undefined || !PLAIN_NUMBER.test(target)) {
    return fail({ kind: "gh-attach-target-not-number", verb });
  }
  const flags = scanGrantFlags({ verb, tokens: flagTokens, flags: [] });
  if (flags.kind === "failure") return flags;
  return succeed({ verb, target, flags: flags.outcome, files });
};

const flagArgumentOf = (flag: GrantFlag): string =>
  flag.kind === "switch" ? flag.name : `${flag.name}=${flag.value}`;

const grantWriteArguments = ({ write, body }: GrantWriteCommand): readonly string[] => [
  ...write.verb.split(" "),
  write.target,
  ...write.flags.map(flagArgumentOf),
  ...write.files.map((file) => `--attach=${file}`),
  ...(body === undefined ? [] : ["--body-file=-"]),
];

export {
  acceptedGrantFlags,
  grantWriteArguments,
  isGrantWriteVerb,
  parseGrantWrite,
  type GrantFlag,
  type GrantWrite,
  type GrantWriteRefusal,
  type GrantWriteVerb,
};
