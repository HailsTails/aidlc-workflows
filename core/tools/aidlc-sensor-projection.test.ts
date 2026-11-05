// covers: file:core/tools/aidlc-sensor-projection.ts
import { describe, expect, test } from "bun:test";
import { projectSensorDocument, requireSensorDocument } from "./aidlc-sensor-projection.ts";

const context = {
  harness: "codex", harnessDir: ".codex", rulesSubdir: "aidlc-rules",
  invocation: "bun .codex/tools/aidlc.ts", memoryRoot: "aidlc/spaces/default/memory",
};
const request = {
  subject: "C:\\source tree\\sensors\\probe.md", destination: "sensors/probe.md",
  body: "command: {{INVOKE}} engine sensor-linter\r\n", context,
  target: { harness: "codex", harnessDir: ".codex" },
};

describe("sensor document projection", () => {
  test("emits the explicit relative payload independently from a Windows source path", () => {
    expect(projectSensorDocument(request)).toEqual({ status: "ok", value: {
      path: "sensors/probe.md", body: "command: bun .codex/tools/aidlc.ts engine sensor-linter\r\n",
    } });
    expect(projectSensorDocument({ ...request, destination: ".codex/sensors/probe.md" })).toEqual({ status: "ok", value: {
      path: ".codex/sensors/probe.md", body: "command: bun .codex/tools/aidlc.ts engine sensor-linter\r\n",
    } });
  });
  test("requires explicit context even for token-free sensors", () => {
    const missingContextProjection = projectSensorDocument({ ...request, body: "plain", context: undefined });
    expect(missingContextProjection.status).toBe("invalid");
    expect(() => requireSensorDocument({ ...request, context: undefined })).toThrow("context: invalid-input");
  });
  test.each(["C:\\sensors\\x.md", "sensors\\x.md", "/sensors/x.md", "../x.md", "sensors/../x.md"])(
    "rejects unsafe payload path %s independently from the Windows source path", (destination) => {
      expect(projectSensorDocument({ ...request, destination }).status).toBe("invalid");
    },
  );
  test("refuses mismatched target identities and token residue", () => {
    expect(projectSensorDocument({ ...request, target: { harness: "kiro-ide", harnessDir: ".codex" } })).toEqual({
      status: "invalid", findings: [{ code: "harness-mismatch", subject: request.subject,
        detail: "content for codex, target for kiro-ide" }],
    });
    expect(projectSensorDocument({ ...request, target: { harness: "codex", harnessDir: ".kiro" } })).toEqual({
      status: "invalid", findings: [{ code: "directory-mismatch", subject: request.subject,
        detail: "content for .codex, target for .kiro" }],
    });
    expect(projectSensorDocument({ ...request, body: "{{TOOL_PREFIX}}" })).toEqual({
      status: "invalid", findings: [{ code: "unresolved-token", subject: request.subject, detail: "{{TOOL_PREFIX}} at line 1" }],
    });
  });
});
