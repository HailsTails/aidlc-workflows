import type { WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";

const TEST_FILE_SUFFIXES: readonly string[] = [".test.ts", ".test.tsx", ".test.mjs", ".test.js", ".spec.ts", ".spec.mjs"];

const testFileEligibility = (request: { readonly file: string }): "eligible" | "skipped" => {
  if (folderScope({ file: request.file }) === "generated") return "skipped";
  return TEST_FILE_SUFFIXES.some((suffix) => request.file.endsWith(suffix)) ? "eligible" : "skipped";
};

const GIT_SPAWN_PATTERN = /\b(?:spawnSync|spawn|execFileSync|execFile|execSync|exec|execa|execaSync)\s*\(\s*(?:"git"|'git'|`git`)/;
const HERMETIC_ENVIRONMENT_PATTERN = /\benv\s*:\s*[^,\n]*\b(?:hermeticGitEnvironment|withoutInheritedGitBindings|environment)\b/;
const AMBIENT_ENVIRONMENT_PATTERN = /\benv\s*:\s*[^,\n]*\bprocess\.env\b/;

export const check: WalkerPiece = {
  prepare: ({ clauses }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file, readText }) => {
        if (testFileEligibility({ file }) === "skipped") {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        const text = readText();
        if (text.outcome === "failed") return text;
        const lines = text.value.split("\n");
        const hits = lines.flatMap((line, index) => {
          if (!GIT_SPAWN_PATTERN.test(line)) return [];
          const span = lines.slice(index, index + 8);
          if (
            !span.some((nearby) => AMBIENT_ENVIRONMENT_PATTERN.test(nearby)) &&
            span.some((nearby) => HERMETIC_ENVIRONMENT_PATTERN.test(nearby))
          ) return [];
          return clauses.map((clause) => ({
            clause: clause.address,
            anchor: { line: index + 1, column: 0 },
            snippet: line.trim(),
          }));
        });
        return { outcome: "ok", value: { kind: "complete", hits } };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
