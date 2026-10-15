import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { NativeException } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { parsedJson } from "../../../core/rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import { suppressionsFileSchema } from "./eslint-file-schemas.ts";
import { repoPathResolved, type SelectedRule } from "./package-script-scanner.ts";

const REPO_ROOT = "repo-root";

export const suppressionEntriesOf = (request: {
  readonly location: RepoPath;
  readonly keysRelativeTo: RepoPath | "repo-root";
  readonly text: string;
  readonly selectedRules: readonly SelectedRule[];
}): Result<readonly NativeException[], RunnerFailure> => {
  const json = parsedJson({ text: request.text });
  if (json.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: `${request.location}: ${json.error}` },
    };
  }
  const suppressions = suppressionsFileSchema.safeParse(json.value);
  if (!suppressions.success) {
    return {
      outcome: "failed",
      error: { kind: "tool-failed", detail: `${request.location}: ${suppressions.error.message}` },
    };
  }
  const baseSegments = request.keysRelativeTo === REPO_ROOT ? [] : request.keysRelativeTo.split("/");
  return Object.entries(suppressions.data).reduce<Result<readonly NativeException[], RunnerFailure>>(
    (entries, [key, rules]) => {
      if (entries.outcome === "failed") {
        return entries;
      }
      const file = repoPathResolved({ baseSegments, path: key });
      if (file.outcome === "failed") {
        return {
          outcome: "failed",
          error: {
            kind: "tool-failed",
            detail: `${request.location}: key ${key} names no file inside the repository`,
          },
        };
      }
      return {
        outcome: "ok",
        value: [
          ...entries.value,
          ...Object.keys(rules).flatMap((ruleId) =>
            request.selectedRules
              .filter((rule) => rule.ruleId === ruleId)
              .map(
                (rule): NativeException => ({
                  kind: "suppression-entry",
                  clause: rule.clause,
                  file: file.value,
                  location: request.location,
                }),
              ),
          ),
        ],
      };
    },
    { outcome: "ok", value: [] },
  );
};

export const scriptSuppressionEntries = (request: {
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly location: RepoPath;
  readonly keysRelativeTo: RepoPath | "repo-root";
  readonly selectedRules: readonly SelectedRule[];
}): Result<readonly NativeException[], RunnerFailure> => {
  const text = request.fileText.read({ path: `${request.repoRoot}/${request.location}` });
  if (text.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", file: request.location, detail: text.error.detail },
    };
  }
  return suppressionEntriesOf({
    location: request.location,
    keysRelativeTo: request.keysRelativeTo,
    text: text.value,
    selectedRules: request.selectedRules,
  });
};
