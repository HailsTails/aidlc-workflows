import { castFindings } from "../runner/legacy-casts.ts";
import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";

const ANY_CAST_SNIPPET = /\bas\s+any\b|:\s*any\b|<any>/;

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => {
    const findings = castFindings({ repository });
    return findings.outcome === "failed" ? findings : {
      outcome: "ok",
      value: findings.value.filter((finding) => ANY_CAST_SNIPPET.test(finding.snippet)),
    };
  },
};
