// covers: file:core/tools/aidlc-projection-text.ts
import { describe, expect, test } from "bun:test";
import { renderTokens, residue } from "./aidlc-projection-text.ts";

const context = {
  harness: "codex", harnessDir: ".codex", rulesSubdir: "aidlc-rules",
  invocation: "bun .codex/tools/aidlc.ts", memoryRoot: "aidlc/spaces/default/memory",
};
describe("authored text projection", () => {
  test("projects each accepted token once while preserving CRLF and literal braces", () => {
    expect(renderTokens({ contract: context,
      text: "{{HARNESS_DIR}}/rules/x\r\n{{HARNESS_DIR}} {{INVOKE}} {{AIDLC_INVOKE}} {{MEMORY_ROOT}} {literal} {{UNKNOWN}}",
    })).toBe(".codex/aidlc-rules/x\r\n.codex bun .codex/tools/aidlc.ts bun .codex/tools/aidlc.ts aidlc/spaces/default/memory {literal} {{UNKNOWN}}");
  });
  test("preserves the native permission rules file while renaming ordinary rules", () => {
    expect(renderTokens({ contract: context, text: "{{HARNESS_DIR}}/rules/default.rules {{HARNESS_DIR}}/rules/code.md" }))
      .toBe(".codex/rules/default.rules .codex/aidlc-rules/code.md");
  });
  test("replacement values are literal, never replacement strings or a second template", () => {
    expect(renderTokens({ contract: { ...context, invocation: '$& $` $\' $$ C:\\tools\\aidlc {{HARNESS_DIR}}' },
      text: "{{INVOKE}}",
    })).toBe('$& $` $\' $$ C:\\tools\\aidlc {{HARNESS_DIR}}');
  });
  test("reports each known missing context token at its original line", () => {
    expect(residue({ subject: "sensor", text: "x\r\n{{TOOL_PREFIX}}\r\n{{OPTION_LETTERS}} {{TRUSTED_NAMESPACE}}" })).toEqual([
      { code: "unresolved-token", subject: "sensor", detail: "{{TOOL_PREFIX}} at line 2" },
      { code: "unresolved-token", subject: "sensor", detail: "{{TRUSTED_NAMESPACE}} at line 3" },
      { code: "unresolved-token", subject: "sensor", detail: "{{OPTION_LETTERS}} at line 3" },
    ]);
  });
});
