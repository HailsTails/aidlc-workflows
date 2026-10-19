import { createDefaultJsoncParsePort, type JsoncParsePort } from "../../../core/platform-ports/jsonc-parse-port.ts";
import type { WalkerPiece } from "../runner/walker-piece.ts";

const EXCLUDED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules", "dist", "dist-release", "build", "coverage", ".git", ".claude", "aidlc", ".aidlc",
]);
const EXCLUDED_ROOT_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "vendor", ".codex", ".opencode", ".agents",
]);

const configEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  const segments = request.file.split("/");
  if (segments.at(-1) !== "tsconfig.json") return "excluded";
  const parents = segments.slice(0, -1);
  if (parents.some((directory) => EXCLUDED_DIRECTORY_NAMES.has(directory))) return "excluded";
  if (EXCLUDED_ROOT_DIRECTORY_NAMES.has(parents[0] ?? "")) return "excluded";
  return "eligible";
};

const STRICT_FLAGS: readonly { readonly clause: string; readonly option: string }[] = [
  { clause: "strict", option: "strict" },
  { clause: "no-unchecked-indexed-access", option: "noUncheckedIndexedAccess" },
  { clause: "exact-optional-property-types", option: "exactOptionalPropertyTypes" },
  { clause: "no-implicit-override", option: "noImplicitOverride" },
  { clause: "no-fallthrough-cases-in-switch", option: "noFallthroughCasesInSwitch" },
  { clause: "no-property-access-from-index-signature", option: "noPropertyAccessFromIndexSignature" },
  { clause: "use-unknown-in-catch-variables", option: "useUnknownInCatchVariables" },
];

export const createCompilerOverridesCheck = (options: { readonly jsonc: JsoncParsePort }): WalkerPiece => ({
  prepare: ({ clauses }) => {
    const selectedFlags = STRICT_FLAGS.flatMap((flag) => clauses
      .filter((clause) => clause.address.discipline === "CD-3" && clause.address.clause === flag.clause)
      .map((clause) => ({ address: clause.address, option: flag.option })));
    return {
      outcome: "ok",
      value: {
        prepareFile: ({ file, readText }) => {
          if (configEligibility({ file }) === "excluded") return { outcome: "ok", value: { kind: "skipped" } };
          const text = readText();
          if (text.outcome === "failed") return text;
          const parsed = options.jsonc.parse({ source: text.value });
          if (parsed.outcome === "failed") {
            return { outcome: "failed", error: { kind: "file-unparseable", file, detail: parsed.error.detail } };
          }
          const config = parsed.value;
          if (typeof config !== "object" || config === null || Array.isArray(config)) {
            return { outcome: "failed", error: { kind: "file-unparseable", file, detail: "configuration root must be an object" } };
          }
          if (!("compilerOptions" in config)) return { outcome: "ok", value: { kind: "complete", hits: [] } };
          const compilerOptions = config.compilerOptions;
          if (typeof compilerOptions !== "object" || compilerOptions === null || Array.isArray(compilerOptions)) {
            return { outcome: "failed", error: { kind: "file-unparseable", file, detail: "compilerOptions must be an object" } };
          }
          const entries: readonly (readonly [string, unknown])[] = Object.entries(compilerOptions);
          const hits = selectedFlags.flatMap((flag) => {
            const entry = entries.find(([key]) => key === flag.option);
            return entry === undefined ? [] : [{
              clause: flag.address,
              anchor: { line: 1, column: 0 },
              snippet: `compilerOptions.${flag.option} = ${JSON.stringify(entry[1])}`,
            }];
          });
          return { outcome: "ok", value: { kind: "complete", hits } };
        },
        finish: () => ({ outcome: "ok", value: [] }),
      },
    };
  },
});

export const check = createCompilerOverridesCheck({ jsonc: createDefaultJsoncParsePort({}) });
