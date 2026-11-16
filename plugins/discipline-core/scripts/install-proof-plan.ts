import { z } from "zod";
import { parsedJson } from "../core/rule-set-reader/rule-set-reader.ts";
import type { Result } from "../core/values/result.ts";
import { PACKAGE_IDENTITY, type PackageIdentity } from "./package-identity.ts";

export type EntryKind = "folder" | "file";

export type EntryDisposition = "left-out" | "kept";

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
  | { readonly kind: "commit"; readonly message: string }
  | { readonly kind: "read"; readonly path: string; readonly contains: string };

export type ProofToolchain = "typescript-floor" | "eslint-9-floor" | "eslint-10-floor";

export type CommandScript = "check" | "project";

export type ProofCase = {
  readonly consumer: string;
  readonly mechanism: Mechanism;
  readonly toolchain: ProofToolchain;
  readonly actions: readonly ProofAction[];
};

export type ManifestFailure = { readonly kind: "manifest-invalid"; readonly detail: string };

const ESLINT_CONSUMER_ACTIONS: readonly ProofAction[] = [
  { kind: "project", expectation: { exitCode: 0, output: { kind: "contains", text: "disciplines.eslint.mjs written" } } },
  {
    kind: "read",
    path: "disciplines.eslint.mjs",
    contains: `import piece0 from "${PACKAGE_IDENTITY.name}/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js";`,
  },
  { kind: "commit", message: "project" },
  { kind: "check", expectation: { exitCode: 1, output: { kind: "contains", text: "verdict: fail" } } },
  { kind: "remove", path: "src/kept.ts" },
  { kind: "commit", message: "clean" },
  { kind: "check", expectation: { exitCode: 0, output: { kind: "contains", text: "verdict: pass" } } },
];

const AUDIT_CONSUMER_ACTIONS: readonly ProofAction[] = [
  { kind: "check", expectation: { exitCode: 1, output: { kind: "contains", text: "verdict: fail" } } },
  { kind: "remove", path: "src/kept.ts" },
  { kind: "commit", message: "clean" },
  { kind: "check", expectation: { exitCode: 0, output: { kind: "contains", text: "verdict: pass" } } },
  { kind: "project", expectation: { exitCode: 0, output: { kind: "empty" } } },
];

const ESLINT_MISSING_ACTIONS: readonly ProofAction[] = [
  {
    kind: "project",
    expectation: { exitCode: 2, output: { kind: "contains", text: "toolchain-unavailable eslint found not installed" } },
  },
];

export const PROOF_CASES: readonly ProofCase[] = [
  { consumer: "audit", mechanism: "audit", toolchain: "typescript-floor", actions: AUDIT_CONSUMER_ACTIONS },
  { consumer: "eslint-10", mechanism: "eslint", toolchain: "eslint-10-floor", actions: ESLINT_CONSUMER_ACTIONS },
  { consumer: "eslint-9", mechanism: "eslint", toolchain: "eslint-9-floor", actions: ESLINT_CONSUMER_ACTIONS },
  { consumer: "eslint-missing", mechanism: "eslint", toolchain: "typescript-floor", actions: ESLINT_MISSING_ACTIONS },
];
export const PACKAGED_SCRIPTS: Readonly<Record<CommandScript, string>> = {
  check: "discipline:check",
  project: "discipline:project",
};

export const PACKAGED_CONSUMER_NPMRC = "node-options=--no-experimental-strip-types\n";

export const packagedConsumerManifest = (request: { readonly identity: PackageIdentity }): string =>
  `${JSON.stringify(
    {
      private: true,
      type: "commonjs",
      scripts: {
        [PACKAGED_SCRIPTS.check]: `${request.identity.checkBin} --repo .`,
        [PACKAGED_SCRIPTS.project]: `${request.identity.projectBin} --repo .`,
      },
    },
    null,
    2,
  )}\n`;

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
