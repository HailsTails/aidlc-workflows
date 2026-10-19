import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import { parsedJson } from "../../../core/rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import { eslintVersionFileSchema, packageJsonSchema } from "./eslint-file-schemas.ts";
import { eslintInvocationsOf, scriptCommandsOf } from "./package-script-scanner.ts";

export type ConfigLookup =
  | { readonly kind: "nearest-to-file" }
  | { readonly kind: "repository-root"; readonly configFile: string };

type EslintMajor = number | "unknown";

const ROOT_LOOKUP_MAJOR = 9;

const ESLINT_PACKAGE_JSON = ["node_modules", "eslint", "package.json"];

const PACKAGE_JSON_NAME = "package.json";

const FLAG_OPTION = "--flag";

const FLAG_OPTION_JOINED = `${FLAG_OPTION}=`;

const NEAREST_LOOKUP_FLAGS: ReadonlySet<string> = new Set([
  "v10_config_lookup_from_file",
  "unstable_config_lookup_from_file",
]);

const ROOT_CONFIG_NAMES: readonly string[] = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
];

const NEAREST: ConfigLookup = { kind: "nearest-to-file" };

type LookupRequest = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
};

const installedEslintMajor = (request: Pick<LookupRequest, "fileText" | "path" | "repoRoot">): EslintMajor => {
  const text = request.fileText.read({ path: request.path.join({ segments: [request.repoRoot, ...ESLINT_PACKAGE_JSON] }) });
  if (text.outcome === "failed") {
    return "unknown";
  }
  const json = parsedJson({ text: text.value });
  const parsed = json.outcome === "ok" ? eslintVersionFileSchema.safeParse(json.value) : undefined;
  const major = parsed?.success ? Number.parseInt(parsed.data.version, 10) : Number.NaN;
  return Number.isNaN(major) ? "unknown" : major;
};

const flagsNamedBy = (request: { readonly options: readonly string[] }): readonly string[] =>
  request.options.flatMap((option, index) => {
    if (option.startsWith(FLAG_OPTION_JOINED)) {
      return [option.slice(FLAG_OPTION_JOINED.length)];
    }
    const next = request.options[index + 1];
    return option === FLAG_OPTION && next !== undefined ? [next] : [];
  });

const scriptsOf = (request: LookupRequest & { readonly packagePath: RepoPath }): readonly string[] => {
  const text = request.fileText.read({ path: request.path.join({ segments: [request.repoRoot, request.packagePath] }) });
  const json = text.outcome === "ok" ? parsedJson({ text: text.value }) : undefined;
  const parsed = json?.outcome === "ok" ? packageJsonSchema.safeParse(json.value) : undefined;
  return parsed?.success ? Object.values(parsed.data.scripts ?? {}) : [];
};

const lintScriptsSelectNearest = (request: LookupRequest): "selects-nearest" | "selects-root" =>
  request.trackedPaths
    .filter((path) => path.split("/").at(-1) === PACKAGE_JSON_NAME)
    .flatMap((packagePath) => scriptsOf({ ...request, packagePath }))
    .flatMap((script) => {
      const commands = scriptCommandsOf({ script });
      return commands.outcome === "ok" ? eslintInvocationsOf({ commands: commands.value }) : [];
    })
    .flatMap((invocation) => flagsNamedBy({ options: invocation.options }))
    .some((flag) => NEAREST_LOOKUP_FLAGS.has(flag))
    ? "selects-nearest"
    : "selects-root";

const rootConfigFile = (request: Pick<LookupRequest, "fileText" | "path" | "repoRoot">): string | undefined =>
  ROOT_CONFIG_NAMES.map((name) => request.path.join({ segments: [request.repoRoot, name] })).find(
    (candidate) => request.fileText.exists({ path: candidate }) === "present",
  );

export const teamConfigLookup = (request: LookupRequest): Result<ConfigLookup, RunnerFailure> => {
  if (installedEslintMajor(request) !== ROOT_LOOKUP_MAJOR || lintScriptsSelectNearest(request) === "selects-nearest") {
    return { outcome: "ok", value: NEAREST };
  }
  const configFile = rootConfigFile(request);
  return configFile === undefined
    ? {
        outcome: "failed",
        error: {
          kind: "team-config-unloadable",
          detail: `ESLint 9 finds only an eslint.config.* in the directory it runs from, and the repository root has none; add one there or run ESLint with --flag v10_config_lookup_from_file`,
        },
      }
    : { outcome: "ok", value: { kind: "repository-root", configFile } };
};
