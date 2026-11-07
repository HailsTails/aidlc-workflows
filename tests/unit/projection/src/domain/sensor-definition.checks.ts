import { expect, mock, test } from "bun:test";
import { createSensorProjector } from "../../../../../scripts/projection/src/domain/sensor-definition.ts";
import { entryBasis } from "../../support/__tests__/harness-document-fixtures.ts";
const origin = { ...entryBasis, path: "core/sensors/aidlc-example.md" };
const document = { fileName: "aidlc-example.md", origin, text: "---\nid: example\ncommand: {{INVOKE}} engine sensor-example\nunknown_extension: retain\n---\nBody\n" };
const context = { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules" } as const;
test("sensor projection delegates authored text without rebuilding its manifest", () => {
  const prose = mock().mockReturnValue({ status: "ok", value: "native descriptor including extension\n" });
  expect(createSensorProjector({ prose }).render({ document, context })).toEqual({ status: "ok", value: { origin, harness: "claude", resources: [{ kind: "file", path: ".claude/sensors/aidlc-example.md", body: "native descriptor including extension\n" }] } });
  expect(prose.mock.calls).toEqual([[{ markdown: document.text, context, subject: "core/sensors/aidlc-example.md" }]]);
});
test("unresolved authored text failure is retained without a partial sensor file", () => {
  const failure = { status: "invalid", findings: [{ code: "unresolved-token", subject: "sensor", detail: "unsupported token" }] } as const;
  expect(createSensorProjector({ prose: mock().mockReturnValue(failure) }).render({ document, context })).toEqual(failure);
});
test.each([{ harness: "claude", directory: ".claude", invocation: "aidlc", rulesSubdir: "rules" }, { harness: "cursor", directory: ".cursor", invocation: "bun .cursor/tools/aidlc.ts", rulesSubdir: "rules" }] as const)("unsupported sensor delivery refuses before text projection", (unsupported) => {
  const prose = mock();
  expect(createSensorProjector({ prose }).render({ document, context: unsupported })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core/sensors/aidlc-example.md", detail: "authored sensor products currently qualify Claude Bun-copy delivery; other harness and native-release outcomes need their own evidence" }] });
  expect(prose).not.toHaveBeenCalled();
});
