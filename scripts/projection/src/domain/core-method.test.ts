import { expect, mock, test } from "bun:test";
import { prepareMethodFiles, type MethodProseRenderer } from "./core-method.ts";
import { methodSources, methodContext, methodFiles, methodFailure, markerSources, markerFiles, methodBasis } from "../../../../tests/unit/projection/support/__tests__/method-fixtures.ts";
test("prepares one authored method for both workspace and recovery delivery", () => {
  const prose = mock<MethodProseRenderer>().mockReturnValue({ status: "ok", value: "prepared" });
  expect(prepareMethodFiles({ sources: methodSources, context: methodContext, prose })).toEqual({ status: "ok", value: methodFiles });
  expect(prose).toHaveBeenCalledTimes(1);
  expect(prose).toHaveBeenCalledWith({ markdown: "raw", context: methodContext, subject: "core/memory/org.md" });
});
test("preserves authored directory-marker bytes and bypasses prose transformation", () => {
  const prose = mock<MethodProseRenderer>();
  expect(prepareMethodFiles({ sources: markerSources, context: methodContext, prose })).toEqual({ status: "ok", value: markerFiles });
  expect(prose).not.toHaveBeenCalled();
});
test("uses the selected engine binding while workspace method placement stays shared", () => {
  const prose = mock<MethodProseRenderer>().mockReturnValue({ status: "ok", value: "prepared" });
  expect(prepareMethodFiles({ sources: methodSources, context: { ...methodContext, harness: "kiro", directory: ".kiro" }, prose })).toEqual({ status: "ok", value: [
    { kind: "prose", origin: { ...methodBasis, path: "core/memory/org.md" }, delivery: "workspace-template", path: "aidlc/spaces/default/memory/org.md", text: "prepared" },
    { kind: "prose", origin: { ...methodBasis, path: "core/memory/org.md" }, delivery: "engine-recovery-seed", path: ".kiro/tools/data/memory-seed/org.md", text: "prepared" },
  ] });
});
test("a failed document refuses the whole method preparation without returning a successful subset", () => {
  const prose = mock<MethodProseRenderer>().mockReturnValueOnce({ status: "ok", value: "prepared" }).mockReturnValueOnce(methodFailure);
  expect(prepareMethodFiles({ sources: { ...methodSources, documents: [{ kind: "prose", origin: { ...methodBasis, path: "core/memory/org.md" }, relativePath: "org.md", text: "raw" }, { kind: "prose", origin: { ...methodBasis, path: "core/memory/team.md" }, relativePath: "team.md", text: "team" }] }, context: methodContext, prose })).toEqual(methodFailure);
  expect(prose).toHaveBeenNthCalledWith(2, { markdown: "team", context: methodContext, subject: "core/memory/team.md" });
});
