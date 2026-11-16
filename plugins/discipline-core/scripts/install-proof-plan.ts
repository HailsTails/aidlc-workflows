import { z } from "zod";
import { parsedJson } from "../core/rule-set-reader/rule-set-reader.ts";
import type { Result } from "../core/values/result.ts";

export type InstallList = {
  readonly always: readonly string[];
  readonly intoRoot: readonly string[];
  readonly perSharedClause: readonly string[];
  readonly leftOut: readonly string[];
};

export type InstallListFailure =
  | { readonly kind: "section-missing"; readonly heading: string }
  | { readonly kind: "line-missing"; readonly prefix: string };

export type InstallPathFailure = { readonly kind: "unresolved-placeholder"; readonly path: string };

export type InstallPlacement = { readonly from: string; readonly to: string };

export type ExclusionRule =
  | { readonly kind: "folder"; readonly name: string }
  | { readonly kind: "file-suffix"; readonly suffix: string }
  | { readonly kind: "file-name"; readonly name: string };

export type EntryKind = "folder" | "file";

export type ExpectedOutput = { readonly kind: "contains"; readonly text: string } | { readonly kind: "empty" };

export type StepExpectation = { readonly exitCode: number; readonly output: ExpectedOutput };

export type StepRun =
  | { readonly outcome: "exited"; readonly exitCode: number; readonly output: string }
  | { readonly outcome: "not-exited"; readonly detail: string };

export type Mechanism = "audit" | "eslint";

export type ProofAction =
  | { readonly kind: "check"; readonly expectation: StepExpectation }
  | { readonly kind: "project"; readonly expectation: StepExpectation }
  | { readonly kind: "remove"; readonly path: string }
  | { readonly kind: "commit"; readonly message: string };

export type ProofToolchain = "typescript-floor" | "eslint-9-floor" | "eslint-10-floor";

export type ProofCase = {
  readonly consumer: string;
  readonly mechanism: Mechanism;
  readonly toolchain: ProofToolchain;
  readonly disciplineId: string;
  readonly installedManifest: "kept" | "removed";
  readonly actions: readonly ProofAction[];
};

export type ManifestFailure = { readonly kind: "manifest-invalid"; readonly detail: string };

const INSTALLING_HEADING = "## Installing";
const ALWAYS_PREFIX = "- always: ";
const INTO_ROOT_PREFIX = "- into the install root: ";
const SHARED_CLAUSE_PREFIX = "- for each selected clause in the shared rule set: ";
const LEFT_OUT_PREFIX = "Leave out ";
const DISCIPLINE_PLACEHOLDER = "<DisciplineId>";
const MECHANISM_PLACEHOLDER = "<MechanismId>";
const PLACEHOLDER_PATTERN = /<[^>]+>/;
const CODE_SPAN_PATTERN = /`([^`]+)`/g;

const ESLINT_CONSUMER_ACTIONS: readonly ProofAction[] = [
  { kind: "project", expectation: { exitCode: 0, output: { kind: "contains", text: "disciplines.eslint.mjs written" } } },
  { kind: "commit", message: "project" },
  { kind: "check", expectation: { exitCode: 1, output: { kind: "contains", text: "verdict: fail" } } },
  { kind: "remove", path: "src/kept.ts" },
  { kind: "commit", message: "clean" },
  { kind: "check", expectation: { exitCode: 0, output: { kind: "contains", text: "verdict: pass" } } },
];

export const PROOF_CASES: readonly ProofCase[] = [
  {
    consumer: "audit",
    mechanism: "audit",
    toolchain: "typescript-floor",
    disciplineId: "CD-23",
    installedManifest: "kept",
    actions: [
      { kind: "check", expectation: { exitCode: 1, output: { kind: "contains", text: "verdict: fail" } } },
      { kind: "remove", path: "src/kept.ts" },
      { kind: "commit", message: "clean" },
      { kind: "check", expectation: { exitCode: 0, output: { kind: "contains", text: "verdict: pass" } } },
      { kind: "project", expectation: { exitCode: 0, output: { kind: "empty" } } },
    ],
  },
  {
    consumer: "eslint-10",
    mechanism: "eslint",
    toolchain: "eslint-10-floor",
    disciplineId: "CD-14",
    installedManifest: "kept",
    actions: ESLINT_CONSUMER_ACTIONS,
  },
  {
    consumer: "eslint-9",
    mechanism: "eslint",
    toolchain: "eslint-9-floor",
    disciplineId: "CD-14",
    installedManifest: "kept",
    actions: ESLINT_CONSUMER_ACTIONS,
  },
  {
    consumer: "eslint-missing",
    mechanism: "eslint",
    toolchain: "typescript-floor",
    disciplineId: "CD-14",
    installedManifest: "kept",
    actions: [
      {
        kind: "project",
        expectation: { exitCode: 2, output: { kind: "contains", text: "toolchain-unavailable eslint found not installed" } },
      },
    ],
  },
  {
    consumer: "no-package-json",
    mechanism: "audit",
    toolchain: "typescript-floor",
    disciplineId: "CD-23",
    installedManifest: "removed",
    actions: [
      {
        kind: "check",
        expectation: { exitCode: 1, output: { kind: "contains", text: "Cannot use import statement outside a module" } },
      },
    ],
  },
];

const sectionLines = (request: { readonly lines: readonly string[]; readonly heading: string }): readonly string[] => {
  const start = request.lines.indexOf(request.heading);
  const following = request.lines.slice(start + 1);
  const nextHeading = following.findIndex((line) => line.startsWith("## "));
  return nextHeading === -1 ? following : following.slice(0, nextHeading);
};

const codeSpans = (request: { readonly text: string }): readonly string[] =>
  [...request.text.matchAll(CODE_SPAN_PATTERN)].map((match) => match[1]);

const firstSentence = (request: { readonly line: string }): string => {
  const segments = request.line.split("`");
  const proseEnd = segments.findIndex(
    (segment, index) => index % 2 === 0 && (segment.includes(". ") || segment.endsWith(".")),
  );
  return proseEnd === -1 ? request.line : segments.slice(0, proseEnd + 1).join("`");
};

const lineStartingWith = (request: {
  readonly lines: readonly string[];
  readonly prefix: string;
}): Result<string, InstallListFailure> => {
  const found = request.lines.find((line) => line.startsWith(request.prefix));
  return found === undefined
    ? { outcome: "failed", error: { kind: "line-missing", prefix: request.prefix } }
    : { outcome: "ok", value: found };
};

export const parsedInstallList = (request: { readonly readme: string }): Result<InstallList, InstallListFailure> => {
  const lines = request.readme.split(/\r?\n/);
  if (!lines.includes(INSTALLING_HEADING)) {
    return { outcome: "failed", error: { kind: "section-missing", heading: INSTALLING_HEADING } };
  }
  const section = sectionLines({ lines, heading: INSTALLING_HEADING });
  const always = lineStartingWith({ lines: section, prefix: ALWAYS_PREFIX });
  if (always.outcome === "failed") {
    return always;
  }
  const intoRoot = lineStartingWith({ lines: section, prefix: INTO_ROOT_PREFIX });
  if (intoRoot.outcome === "failed") {
    return intoRoot;
  }
  const perSharedClause = lineStartingWith({ lines: section, prefix: SHARED_CLAUSE_PREFIX });
  if (perSharedClause.outcome === "failed") {
    return perSharedClause;
  }
  const leftOut = lineStartingWith({ lines: section, prefix: LEFT_OUT_PREFIX });
  if (leftOut.outcome === "failed") {
    return leftOut;
  }
  return {
    outcome: "ok",
    value: {
      always: codeSpans({ text: always.value }),
      intoRoot: codeSpans({ text: intoRoot.value }),
      perSharedClause: codeSpans({ text: perSharedClause.value }),
      leftOut: codeSpans({ text: firstSentence({ line: leftOut.value }) }),
    },
  };
};

const withoutTrailingSlash = (request: { readonly path: string }): string =>
  request.path.endsWith("/") ? request.path.slice(0, -1) : request.path;

const inPlace = (request: { readonly path: string }): InstallPlacement => {
  const path = withoutTrailingSlash(request);
  return { from: path, to: path };
};

const atInstallRoot = (request: { readonly path: string }): InstallPlacement => ({
  from: request.path,
  to: request.path.slice(request.path.lastIndexOf("/") + 1),
});

export const intoRootPlacements = (request: { readonly installList: InstallList }): readonly InstallPlacement[] =>
  request.installList.intoRoot.map((path) => atInstallRoot({ path }));

export const installPlacements = (request: {
  readonly installList: InstallList;
  readonly disciplineId: string;
  readonly mechanism: Mechanism;
}): Result<readonly InstallPlacement[], InstallPathFailure> => {
  const substituted = request.installList.perSharedClause.map((path) =>
    path.replaceAll(DISCIPLINE_PLACEHOLDER, request.disciplineId).replaceAll(MECHANISM_PLACEHOLDER, request.mechanism),
  );
  const unresolved = substituted.find((path) => PLACEHOLDER_PATTERN.test(path));
  return unresolved === undefined
    ? {
        outcome: "ok",
        value: [
          ...request.installList.always.map((path) => inPlace({ path })),
          ...intoRootPlacements(request),
          ...substituted.map((path) => inPlace({ path })),
        ],
      }
    : { outcome: "failed", error: { kind: "unresolved-placeholder", path: unresolved } };
};

export const exclusionRules = (request: { readonly leftOut: readonly string[] }): readonly ExclusionRule[] =>
  request.leftOut.map((name): ExclusionRule => {
    if (name.endsWith("/")) {
      return { kind: "folder", name: name.slice(0, -1) };
    }
    if (name.startsWith("*")) {
      return { kind: "file-suffix", suffix: name.slice(1) };
    }
    return { kind: "file-name", name };
  });

export type EntryDisposition = "left-out" | "kept";

const ruleDisposition = (request: {
  readonly rule: ExclusionRule;
  readonly name: string;
  readonly entryKind: EntryKind;
}): EntryDisposition => {
  switch (request.rule.kind) {
    case "folder":
      return request.entryKind === "folder" && request.name === request.rule.name ? "left-out" : "kept";
    case "file-suffix":
      return request.entryKind === "file" && request.name.endsWith(request.rule.suffix) ? "left-out" : "kept";
    case "file-name":
      return request.entryKind === "file" && request.name === request.rule.name ? "left-out" : "kept";
  }
};

export const entryDisposition = (request: {
  readonly rules: readonly ExclusionRule[];
  readonly name: string;
  readonly entryKind: EntryKind;
}): EntryDisposition =>
  request.rules.some(
    (rule) => ruleDisposition({ rule, name: request.name, entryKind: request.entryKind }) === "left-out",
  )
    ? "left-out"
    : "kept";

const describedOutput = (request: { readonly output: ExpectedOutput }): string => {
  switch (request.output.kind) {
    case "contains":
      return `"${request.output.text}"`;
    case "empty":
      return `""`;
  }
};

type OutputVerdict = "met" | "unmet";

const outputVerdict = (request: { readonly expected: ExpectedOutput; readonly output: string }): OutputVerdict => {
  switch (request.expected.kind) {
    case "contains":
      return request.output.includes(request.expected.text) ? "met" : "unmet";
    case "empty":
      return request.output === "" ? "met" : "unmet";
  }
};

export const judgedStep = (request: {
  readonly label: string;
  readonly expectation: StepExpectation;
  readonly run: StepRun;
}): Result<string, string> => {
  const expected = `expected exit ${request.expectation.exitCode} and ${describedOutput({ output: request.expectation.output })}`;
  if (request.run.outcome === "not-exited") {
    return { outcome: "failed", error: `FAIL: ${request.label}: ${expected}, but it did not exit: ${request.run.detail}` };
  }
  return request.run.exitCode === request.expectation.exitCode &&
    outputVerdict({ expected: request.expectation.output, output: request.run.output }) === "met"
    ? {
        outcome: "ok",
        value: `ok: ${request.label} -> exit ${request.run.exitCode}, ${describedOutput({ output: request.expectation.output })}`,
      }
    : {
        outcome: "failed",
        error: `FAIL: ${request.label}: ${expected}, got exit ${request.run.exitCode}\n${request.run.output}`,
      };
};

const toolchainManifestSchema = z.object({
  peerDependencies: z.record(z.string(), z.string()),
  devDependencies: z.record(z.string(), z.string()),
});

type ToolchainManifest = z.output<typeof toolchainManifestSchema>;

type FloorPins = Readonly<Record<string, string>>;

const TYPESCRIPT_FLOOR: FloorPins = { typescript: "typescript-floor" };

const TYPESCRIPT_ESLINT_FLOOR: FloorPins = {
  ...TYPESCRIPT_FLOOR,
  "@typescript-eslint/parser": "typescript-eslint-parser-floor",
  "@typescript-eslint/eslint-plugin": "typescript-eslint-plugin-floor",
};

const FLOOR_PINS: Readonly<Record<ProofToolchain, FloorPins>> = {
  "typescript-floor": TYPESCRIPT_FLOOR,
  "eslint-9-floor": { ...TYPESCRIPT_ESLINT_FLOOR, eslint: "eslint-9-floor" },
  "eslint-10-floor": { ...TYPESCRIPT_ESLINT_FLOOR, eslint: "eslint-10-floor" },
};

export const CONSUMER_MANIFEST = `${JSON.stringify({ private: true, type: "commonjs" }, null, 2)}\n`;

const manifestInvalid = (request: { readonly detail: string }): Result<never, ManifestFailure> => ({
  outcome: "failed",
  error: { kind: "manifest-invalid", detail: request.detail },
});

const floorVersion = (request: {
  readonly manifest: ToolchainManifest;
  readonly peer: string;
  readonly pinName: string;
}): Result<string, ManifestFailure> => {
  const pin = request.manifest.devDependencies[request.pinName];
  if (pin === undefined) {
    return manifestInvalid({ detail: `no development pin ${request.pinName} for the peer ${request.peer}` });
  }
  const aliasPrefix = `npm:${request.peer}@`;
  if (!pin.startsWith(aliasPrefix)) {
    return manifestInvalid({ detail: `the development pin ${request.pinName} is ${pin}, not an alias of ${request.peer}` });
  }
  return request.peer in request.manifest.peerDependencies
    ? { outcome: "ok", value: pin.slice(aliasPrefix.length) }
    : manifestInvalid({ detail: `${request.peer} is not a declared peer` });
};

const floorVersions = (request: {
  readonly manifest: ToolchainManifest;
  readonly toolchain: ProofToolchain;
}): Result<FloorPins, ManifestFailure> =>
  Object.entries(FLOOR_PINS[request.toolchain]).reduce<Result<FloorPins, ManifestFailure>>((sofar, [peer, pinName]) => {
    if (sofar.outcome === "failed") {
      return sofar;
    }
    const version = floorVersion({ manifest: request.manifest, peer, pinName });
    return version.outcome === "failed" ? version : { outcome: "ok", value: { ...sofar.value, [peer]: version.value } };
  }, { outcome: "ok", value: {} });

export const toolchainManifest = (request: {
  readonly developmentManifest: string;
  readonly toolchain: ProofToolchain;
}): Result<string, ManifestFailure> => {
  const parsed = parsedJson({ text: request.developmentManifest });
  if (parsed.outcome === "failed") {
    return manifestInvalid({ detail: parsed.error });
  }
  const manifest = toolchainManifestSchema.safeParse(parsed.value);
  if (!manifest.success) {
    return manifestInvalid({ detail: manifest.error.message });
  }
  const versions = floorVersions({ manifest: manifest.data, toolchain: request.toolchain });
  return versions.outcome === "failed"
    ? versions
    : { outcome: "ok", value: `${JSON.stringify({ private: true, devDependencies: versions.value }, null, 2)}\n` };
};
export const environmentWithoutGit = (request: {
  readonly environment: Readonly<Record<string, string | undefined>>;
}): Readonly<Record<string, string | undefined>> =>
  Object.fromEntries(Object.entries(request.environment).filter(([name]) => !name.startsWith("GIT_")));
