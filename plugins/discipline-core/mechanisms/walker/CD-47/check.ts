import { z } from "zod";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";

const ALLOWANCE_FILE: RepoPath = z
  .literal(".hermetic-git-allowances.json")
  .brand<"RepoPath">()
  .parse(".hermetic-git-allowances.json");
const PRUNED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  "vendor",
  ".aidlc-dist",
  "worktrees",
]);
const TEST_SUFFIXES = [
  ".test.ts",
  ".test.tsx",
  ".test.mjs",
  ".test.js",
  ".spec.ts",
  ".spec.mjs",
] as const;
const GIT_SPAWN_PATTERN =
  /\b(?:spawnSync|spawn|execFileSync|execFile|execSync|exec|execa|execaSync)\s*\(\s*(?:"git"|'git'|`git`)/;
const HERMETIC_ENVIRONMENT_PATTERN =
  /\benv\s*:\s*[^,\n]*\b(?:hermeticGitEnvironment|withoutInheritedGitBindings|environment)\b/;
const AMBIENT_ENVIRONMENT_PATTERN = /\benv\s*:\s*[^,\n]*\bprocess\.env\b/;
const settingsSchema = z.object({
  minimumExpectedTestFiles: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
});
const allowanceSchema = z.object({ file: z.string(), reason: z.string().trim().min(1) });

const allowancesFrom = (source: string): readonly string[] => {
  const parsed: unknown = (() => {
    try {
      return JSON.parse(source);
    } catch {
      return undefined;
    }
  })();
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry: unknown) => {
    const allowance = allowanceSchema.safeParse(entry);
    return allowance.success ? [allowance.data.file] : [];
  });
};

const findingsFor = ({
  file,
  source,
}: {
  readonly file: RepoPath;
  readonly source: string;
}): readonly LocatedSnippet[] => {
  const lines = source.split("\n");
  return lines.flatMap((body, index) => {
    const span = lines.slice(index, index + 8);
    const hermetic =
      !span.some((line) => AMBIENT_ENVIRONMENT_PATTERN.test(line)) &&
      span.some((line) => HERMETIC_ENVIRONMENT_PATTERN.test(line));
    return GIT_SPAWN_PATTERN.test(body) && !hermetic
      ? [{ file, anchor: { line: index + 1, column: 0 }, snippet: body.trim() }]
      : [];
  });
};

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository, settings }) => {
    const config = settingsSchema.safeParse(settings);
    if (!config.success)
      return {
        outcome: "failed",
        error: { kind: "tool-failed", detail: `invalid CD-47 settings: ${config.error.message}` },
      };
    const candidates = repository.trackedPaths.filter(
      (file) =>
        TEST_SUFFIXES.some((suffix) => file.endsWith(suffix)) &&
        !file
          .split("/")
          .slice(0, -1)
          .some((directory) => PRUNED_DIRECTORIES.has(directory)),
    );
    if (candidates.length < config.data.minimumExpectedTestFiles)
      return {
        outcome: "failed",
        error: {
          kind: "tool-failed",
          detail: `Hermetic-git guard: scanned ${candidates.length} test file(s), expected at least ${config.data.minimumExpectedTestFiles}.`,
        },
      };
    const allowanceText =
      repository.exists({ file: ALLOWANCE_FILE }) === "present"
        ? repository.readText({ file: ALLOWANCE_FILE })
        : ({ outcome: "ok", value: "[]" } as const);
    const allowances = allowanceText.outcome === "ok" ? allowancesFrom(allowanceText.value) : [];
    const offending: LocatedSnippet[] = [];
    for (const file of candidates) {
      const content = repository.readText({ file });
      if (content.outcome === "failed") return content;
      offending.push(...findingsFor({ file, source: content.value }));
    }
    const offendingPaths: ReadonlySet<string> = new Set(offending.map((finding) => finding.file));
    const findings = offending.filter((finding) => !allowances.includes(finding.file));
    const stale = allowances
      .filter((allowance) => !offendingPaths.has(allowance))
      .map((allowance) => ({
        file: ALLOWANCE_FILE,
        anchor: { line: 1, column: 0 },
        snippet: `[stale allowance] ${allowance} — suppresses nothing; delete the entry from ${ALLOWANCE_FILE}`,
      }));
    return { outcome: "ok", value: [...findings, ...stale] };
  },
};
