import { z } from "zod";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { NativeException } from "../../../core/mechanism-port/runner-result-schema.ts";
import { parsedJson } from "../../../core/rule-set-reader/rule-set-reader.ts";
import type { ClauseAddress } from "../../../core/values/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import { packageJsonSchema } from "./eslint-file-schemas.ts";

export type SelectedRule = {
  readonly ruleId: string;
  readonly clause: ClauseAddress;
};

export type ScriptCommand = readonly string[];

export type EslintInvocation = {
  readonly options: readonly string[];
};

export type WeakeningOption = {
  readonly option: string;
  readonly ruleIds: readonly string[];
};

export type ScriptSuppressionsLocation = {
  readonly location: RepoPath;
  readonly script: string;
};

export type PackageJsonScan = {
  readonly nativeExceptions: readonly NativeException[];
  readonly suppressionsLocations: readonly ScriptSuppressionsLocation[];
};

type ScriptPiece =
  | { readonly kind: "quoted"; readonly text: string }
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "operator" }
  | { readonly kind: "space" }
  | { readonly kind: "stray-quote" };

type TokenInProgress =
  | { readonly presence: "none" }
  | { readonly presence: "started"; readonly text: string };

type TokenizerState =
  | {
      readonly status: "reading";
      readonly commands: readonly ScriptCommand[];
      readonly tokens: readonly string[];
      readonly token: TokenInProgress;
    }
  | { readonly status: "unterminated" };

type OptionArity = "takes-value" | "flag";

type OptionReach = "named-rules" | "every-clause";

type WeakeningSpec = {
  readonly name: string;
  readonly arity: OptionArity;
  readonly reach: OptionReach;
};

type OptionOccurrence = {
  readonly option: string;
  readonly optionValue: string;
};

type EslintNaming = "names-eslint" | "names-other";

type SegmentWalk =
  | { readonly position: "inside"; readonly segments: readonly string[] }
  | { readonly position: "outside" };

const SCRIPT_PIECES =
  /(?<single>'[^']*')|(?<double>"[^"]*")|(?<operator>&&|\|\||[;|])|(?<space>\s+)|(?<text>[^'"\s;|&]+|&)|(?<stray>['"])/g;

const ESLINT_TOKEN = "eslint";

const ESLINT_VERSIONED_PREFIX = "eslint@";

const ESLINT_PATH_SUFFIXES: readonly string[] = ["/eslint", "/eslint.js"];

const FORWARDED_OPTIONS_SEPARATOR = "--";

const SUPPRESSIONS_LOCATION_OPTION = "--suppressions-location";

const RULE_VALUE_SEPARATORS = /[,:]/;

const SURROUNDING_QUOTES = /^(["'])(?<inner>.*)\1$/;

const WEAKENING_OPTIONS: readonly WeakeningSpec[] = [
  { name: "--rule", arity: "takes-value", reach: "named-rules" },
  { name: "--suppress-rule", arity: "takes-value", reach: "named-rules" },
  { name: "--suppress-all", arity: "flag", reach: "every-clause" },
  { name: "--ignore-pattern", arity: "takes-value", reach: "every-clause" },
  { name: "-c", arity: "takes-value", reach: "every-clause" },
  { name: "--config", arity: "takes-value", reach: "every-clause" },
  { name: "--no-config-lookup", arity: "flag", reach: "every-clause" },
  { name: "--parser", arity: "takes-value", reach: "every-clause" },
  { name: "--parser-options", arity: "takes-value", reach: "every-clause" },
  { name: "--plugin", arity: "takes-value", reach: "every-clause" },
];

const scriptPieceOf = (request: { readonly match: RegExpMatchArray }): ScriptPiece => {
  const groups = request.match.groups ?? {};
  if (groups.single !== undefined) {
    return { kind: "quoted", text: groups.single.slice(1, -1) };
  }
  if (groups.double !== undefined) {
    return { kind: "quoted", text: groups.double.slice(1, -1) };
  }
  if (groups.operator !== undefined) {
    return { kind: "operator" };
  }
  if (groups.space !== undefined) {
    return { kind: "space" };
  }
  if (groups.text !== undefined) {
    return { kind: "text", text: groups.text };
  }
  return { kind: "stray-quote" };
};

const tokensWithCurrent = (request: {
  readonly tokens: readonly string[];
  readonly token: TokenInProgress;
}): readonly string[] =>
  request.token.presence === "started" ? [...request.tokens, request.token.text] : request.tokens;

const extendedToken = (request: {
  readonly token: TokenInProgress;
  readonly text: string;
}): TokenInProgress => ({
  presence: "started",
  text: request.token.presence === "started" ? `${request.token.text}${request.text}` : request.text,
});

const nextTokenizerState = (request: {
  readonly state: TokenizerState;
  readonly piece: ScriptPiece;
}): TokenizerState => {
  const state = request.state;
  if (state.status === "unterminated") {
    return state;
  }
  switch (request.piece.kind) {
    case "stray-quote":
      return { status: "unterminated" };
    case "quoted":
    case "text":
      return { ...state, token: extendedToken({ token: state.token, text: request.piece.text }) };
    case "space":
      return {
        ...state,
        tokens: tokensWithCurrent({ tokens: state.tokens, token: state.token }),
        token: { presence: "none" },
      };
    case "operator":
      return {
        status: "reading",
        commands: [...state.commands, tokensWithCurrent({ tokens: state.tokens, token: state.token })],
        tokens: [],
        token: { presence: "none" },
      };
  }
};

export const scriptCommandsOf = (request: {
  readonly script: string;
}): Result<readonly ScriptCommand[], { readonly kind: "unterminated-quote" }> => {
  const finalState = [...request.script.matchAll(SCRIPT_PIECES)]
    .map((match) => scriptPieceOf({ match }))
    .reduce<TokenizerState>((state, piece) => nextTokenizerState({ state, piece }), {
      status: "reading",
      commands: [],
      tokens: [],
      token: { presence: "none" },
    });
  if (finalState.status === "unterminated") {
    return { outcome: "failed", error: { kind: "unterminated-quote" } };
  }
  return {
    outcome: "ok",
    value: [
      ...finalState.commands,
      tokensWithCurrent({ tokens: finalState.tokens, token: finalState.token }),
    ].filter((command) => command.length > 0),
  };
};

const eslintNamingOf = (request: { readonly token: string }): EslintNaming =>
  request.token === ESLINT_TOKEN ||
  request.token.startsWith(ESLINT_VERSIONED_PREFIX) ||
  ESLINT_PATH_SUFFIXES.some((suffix) => request.token.endsWith(suffix))
    ? "names-eslint"
    : "names-other";

const invocationOf = (request: { readonly command: ScriptCommand }): readonly EslintInvocation[] => {
  const eslintIndex = request.command.findIndex((token) => eslintNamingOf({ token }) === "names-eslint");
  if (eslintIndex === -1) {
    return [];
  }
  return [
    {
      options: request.command
        .slice(eslintIndex + 1)
        .filter((token) => token !== FORWARDED_OPTIONS_SEPARATOR),
    },
  ];
};

export const eslintInvocationsOf = (request: {
  readonly commands: readonly ScriptCommand[];
}): readonly EslintInvocation[] => request.commands.flatMap((command) => invocationOf({ command }));

const occurrenceFormOf = (request: {
  readonly token: string;
  readonly name: string;
  readonly arity: OptionArity;
}): "joined-value" | "separate" | "not-this-option" => {
  if (request.arity === "takes-value" && request.token.startsWith(`${request.name}=`)) {
    return "joined-value";
  }
  return request.token === request.name ? "separate" : "not-this-option";
};

const occurrenceAt = (request: {
  readonly token: string;
  readonly next: string;
  readonly name: string;
  readonly arity: OptionArity;
}): readonly OptionOccurrence[] => {
  const form = occurrenceFormOf({ token: request.token, name: request.name, arity: request.arity });
  if (form === "not-this-option") {
    return [];
  }
  if (form === "joined-value") {
    return [{ option: request.token, optionValue: request.token.slice(request.name.length + 1) }];
  }
  const optionValue = request.arity === "takes-value" ? request.next : "";
  return [
    {
      option: optionValue === "" ? request.token : `${request.token} ${optionValue}`,
      optionValue,
    },
  ];
};

const ruleIdsNamedBy = (request: {
  readonly value: string;
  readonly selectedRuleIds: readonly string[];
}): readonly string[] => {
  const named = request.value
    .split(RULE_VALUE_SEPARATORS)
    .map((part) => part.trim())
    .map((part) => SURROUNDING_QUOTES.exec(part)?.groups?.inner ?? part);
  return request.selectedRuleIds.filter((ruleId) => named.includes(ruleId));
};

const reachedRuleIds = (request: {
  readonly spec: WeakeningSpec;
  readonly optionValue: string;
  readonly selectedRuleIds: readonly string[];
}): readonly string[] =>
  request.spec.reach === "every-clause"
    ? request.selectedRuleIds
    : ruleIdsNamedBy({ value: request.optionValue, selectedRuleIds: request.selectedRuleIds });

const specWeakenings = (request: {
  readonly spec: WeakeningSpec;
  readonly token: string;
  readonly next: string;
  readonly selectedRuleIds: readonly string[];
}): readonly WeakeningOption[] =>
  occurrenceAt({
    token: request.token,
    next: request.next,
    name: request.spec.name,
    arity: request.spec.arity,
  }).map((occurrence) => ({
    option: occurrence.option,
    ruleIds: reachedRuleIds({
      spec: request.spec,
      optionValue: occurrence.optionValue,
      selectedRuleIds: request.selectedRuleIds,
    }),
  }));

const tokenWeakenings = (request: {
  readonly token: string;
  readonly next: string;
  readonly selectedRuleIds: readonly string[];
}): readonly WeakeningOption[] => WEAKENING_OPTIONS.flatMap((spec) => specWeakenings({ ...request, spec }));

export const commandLineOptionsOf = (request: {
  readonly invocation: EslintInvocation;
  readonly selectedRuleIds: readonly string[];
}): readonly WeakeningOption[] =>
  request.invocation.options
    .flatMap((token, index) =>
      tokenWeakenings({
        token,
        next: request.invocation.options[index + 1] ?? "",
        selectedRuleIds: request.selectedRuleIds,
      }),
    )
    .filter((weakening) => weakening.ruleIds.length > 0);

const suppressionsLocationsAt = (request: { readonly token: string; readonly next: string }): readonly string[] =>
  occurrenceAt({
    token: request.token,
    next: request.next,
    name: SUPPRESSIONS_LOCATION_OPTION,
    arity: "takes-value",
  }).map((occurrence) => occurrence.optionValue);

export const suppressionsLocationValuesOf = (request: {
  readonly invocation: EslintInvocation;
}): readonly string[] =>
  request.invocation.options.flatMap((token, index) =>
    suppressionsLocationsAt({ token, next: request.invocation.options[index + 1] ?? "" }),
  );

const nextWalk = (request: { readonly walk: SegmentWalk; readonly segment: string }): SegmentWalk => {
  const walk = request.walk;
  if (walk.position === "outside" || request.segment === "" || request.segment === ".") {
    return walk;
  }
  if (request.segment === ".." && walk.segments.length === 0) {
    return { position: "outside" };
  }
  if (request.segment === "..") {
    return { position: "inside", segments: walk.segments.slice(0, -1) };
  }
  return { position: "inside", segments: [...walk.segments, request.segment] };
};

const walkedSegments = (request: {
  readonly baseSegments: readonly string[];
  readonly path: string;
}): SegmentWalk =>
  [...request.baseSegments, ...request.path.split("/")].reduce<SegmentWalk>(
    (walk, segment) => nextWalk({ walk, segment }),
    { position: "inside", segments: [] },
  );

export const repoPathResolved = (request: {
  readonly baseSegments: readonly string[];
  readonly path: string;
}): Result<RepoPath, { readonly kind: "not-repo-path"; readonly path: string }> => {
  const refused: Result<RepoPath, { readonly kind: "not-repo-path"; readonly path: string }> = {
    outcome: "failed",
    error: { kind: "not-repo-path", path: request.path },
  };
  if (request.path.startsWith("/")) {
    return refused;
  }
  const walk = walkedSegments(request);
  if (walk.position === "outside") {
    return refused;
  }
  const parsed = repoPathSchema.safeParse(walk.segments.join("/"));
  if (!parsed.success) {
    return refused;
  }
  return { outcome: "ok", value: parsed.data };
};

const weakeningExceptions = (request: {
  readonly weakening: WeakeningOption;
  readonly path: RepoPath;
  readonly script: string;
  readonly selectedRules: readonly SelectedRule[];
}): readonly NativeException[] =>
  request.selectedRules
    .filter((rule) => request.weakening.ruleIds.includes(rule.ruleId))
    .map(
      (rule): NativeException => ({
        kind: "command-line-option",
        clause: rule.clause,
        location: request.path,
        script: request.script,
        option: request.weakening.option,
      }),
    );

const commandLineExceptions = (request: {
  readonly invocations: readonly EslintInvocation[];
  readonly path: RepoPath;
  readonly script: string;
  readonly selectedRules: readonly SelectedRule[];
}): readonly NativeException[] => {
  const selectedRuleIds = request.selectedRules.map((rule) => rule.ruleId);
  return request.invocations
    .flatMap((invocation) => commandLineOptionsOf({ invocation, selectedRuleIds }))
    .flatMap((weakening) => weakeningExceptions({ ...request, weakening }));
};

const locatedScan = (request: {
  readonly scan: Result<PackageJsonScan, RunnerFailure>;
  readonly locationText: string;
  readonly baseSegments: readonly string[];
  readonly path: RepoPath;
  readonly script: string;
}): Result<PackageJsonScan, RunnerFailure> => {
  if (request.scan.outcome === "failed") {
    return request.scan;
  }
  const location = repoPathResolved({ baseSegments: request.baseSegments, path: request.locationText });
  if (location.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: `script "${request.script}" in ${request.path} names --suppressions-location ${request.locationText}, which is not a repo path`,
      },
    };
  }
  return {
    outcome: "ok",
    value: {
      nativeExceptions: request.scan.value.nativeExceptions,
      suppressionsLocations: [
        ...request.scan.value.suppressionsLocations,
        { location: location.value, script: request.script },
      ],
    },
  };
};

const scriptScan = (request: {
  readonly path: RepoPath;
  readonly script: string;
  readonly scriptText: string;
  readonly selectedRules: readonly SelectedRule[];
}): Result<PackageJsonScan, RunnerFailure> => {
  const commands = scriptCommandsOf({ script: request.scriptText });
  if (commands.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: `script "${request.script}" in ${request.path} has an unterminated quote`,
      },
    };
  }
  const invocations = eslintInvocationsOf({ commands: commands.value });
  const baseSegments = request.path.split("/").slice(0, -1);
  return invocations
    .flatMap((invocation) => suppressionsLocationValuesOf({ invocation }))
    .reduce<Result<PackageJsonScan, RunnerFailure>>(
      (scan, locationText) =>
        locatedScan({ scan, locationText, baseSegments, path: request.path, script: request.script }),
      {
        outcome: "ok",
        value: {
          nativeExceptions: commandLineExceptions({ ...request, invocations }),
          suppressionsLocations: [],
        },
      },
    );
};

const mergedScriptScan = (request: {
  readonly scan: Result<PackageJsonScan, RunnerFailure>;
  readonly script: string;
  readonly scriptText: string;
  readonly path: RepoPath;
  readonly selectedRules: readonly SelectedRule[];
}): Result<PackageJsonScan, RunnerFailure> => {
  if (request.scan.outcome === "failed") {
    return request.scan;
  }
  const scanned = scriptScan({
    path: request.path,
    script: request.script,
    scriptText: request.scriptText,
    selectedRules: request.selectedRules,
  });
  if (scanned.outcome === "failed") {
    return scanned;
  }
  return {
    outcome: "ok",
    value: {
      nativeExceptions: [...request.scan.value.nativeExceptions, ...scanned.value.nativeExceptions],
      suppressionsLocations: [
        ...request.scan.value.suppressionsLocations,
        ...scanned.value.suppressionsLocations,
      ],
    },
  };
};

export const scanPackageJson = (request: {
  readonly path: RepoPath;
  readonly text: string;
  readonly selectedRules: readonly SelectedRule[];
}): Result<PackageJsonScan, RunnerFailure> => {
  const json = parsedJson({ text: request.text });
  if (json.outcome === "failed") {
    return { outcome: "failed", error: { kind: "tool-failed", detail: `${request.path}: ${json.error}` } };
  }
  const packageJson = packageJsonSchema.safeParse(json.value);
  if (!packageJson.success) {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: `${request.path}: ${z.prettifyError(packageJson.error)}` },
    };
  }
  return Object.entries(packageJson.data.scripts ?? {}).reduce<Result<PackageJsonScan, RunnerFailure>>(
    (scan, [script, scriptText]) =>
      mergedScriptScan({ scan, script, scriptText, path: request.path, selectedRules: request.selectedRules }),
    { outcome: "ok", value: { nativeExceptions: [], suppressionsLocations: [] } },
  );
};
