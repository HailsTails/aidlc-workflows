import { z } from "zod";
import { parsedJson } from "../core/rule-set-reader/rule-set-reader.ts";
import type { Result } from "../core/values/result.ts";

export type InstallList = {
  readonly always: readonly string[];
  readonly perSharedClause: readonly string[];
  readonly leftOut: readonly string[];
};

export type InstallListFailure =
  | { readonly kind: "section-missing"; readonly heading: string }
  | { readonly kind: "line-missing"; readonly prefix: string };

export type InstallPathFailure = { readonly kind: "unresolved-placeholder"; readonly path: string };

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

export type ProofCase = {
  readonly consumer: string;
  readonly mechanism: Mechanism;
  readonly disciplineId: string;
  readonly installedManifest: "kept" | "removed";
  readonly actions: readonly ProofAction[];
};

export type ManifestFailure = { readonly kind: "manifest-invalid"; readonly detail: string };

const INSTALLING_HEADING = "## Installing";
const ALWAYS_PREFIX = "- always: ";
const SHARED_CLAUSE_PREFIX = "- for each selected clause in the shared rule set: ";
const LEFT_OUT_PREFIX = "Leave out ";
const DISCIPLINE_PLACEHOLDER = "<DisciplineId>";
const MECHANISM_PLACEHOLDER = "<MechanismId>";
const PLACEHOLDER_PATTERN = /<[^>]+>/;
const CODE_SPAN_PATTERN = /`([^`]+)`/g;

export const PROOF_CASES: readonly ProofCase[] = [
  {
    consumer: "audit",
    mechanism: "audit",
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
    consumer: "eslint",
    mechanism: "eslint",
    disciplineId: "CD-14",
    installedManifest: "kept",
    actions: [
      { kind: "project", expectation: { exitCode: 0, output: { kind: "contains", text: "disciplines.eslint.mjs written" } } },
      { kind: "commit", message: "project" },
      { kind: "check", expectation: { exitCode: 1, output: { kind: "contains", text: "verdict: fail" } } },
      { kind: "remove", path: "src/kept.ts" },
      { kind: "commit", message: "clean" },
      { kind: "check", expectation: { exitCode: 0, output: { kind: "contains", text: "verdict: pass" } } },
    ],
  },
  {
    consumer: "no-package-json",
    mechanism: "audit",
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
      perSharedClause: codeSpans({ text: perSharedClause.value }),
      leftOut: codeSpans({ text: firstSentence({ line: leftOut.value }) }),
    },
  };
};

export const installPaths = (request: {
  readonly installList: InstallList;
  readonly disciplineId: string;
  readonly mechanism: Mechanism;
}): Result<readonly string[], InstallPathFailure> => {
  const substituted = [...request.installList.always, ...request.installList.perSharedClause].map((path) =>
    path.replaceAll(DISCIPLINE_PLACEHOLDER, request.disciplineId).replaceAll(MECHANISM_PLACEHOLDER, request.mechanism),
  );
  const unresolved = substituted.find((path) => PLACEHOLDER_PATTERN.test(path));
  return unresolved === undefined
    ? { outcome: "ok", value: substituted.map((path) => (path.endsWith("/") ? path.slice(0, -1) : path)) }
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

const dependenciesManifestSchema = z.object({ dependencies: z.record(z.string(), z.string()) });

export const consumerRootManifest = (request: { readonly packageManifest: string }): Result<string, ManifestFailure> => {
  const parsed = parsedJson({ text: request.packageManifest });
  if (parsed.outcome === "failed") {
    return { outcome: "failed", error: { kind: "manifest-invalid", detail: parsed.error } };
  }
  const manifest = dependenciesManifestSchema.safeParse(parsed.value);
  return manifest.success
    ? { outcome: "ok", value: request.packageManifest }
    : { outcome: "failed", error: { kind: "manifest-invalid", detail: manifest.error.message } };
};

export const environmentWithoutGit = (request: {
  readonly environment: Readonly<Record<string, string | undefined>>;
}): Readonly<Record<string, string | undefined>> =>
  Object.fromEntries(Object.entries(request.environment).filter(([name]) => !name.startsWith("GIT_")));
