import { expect, test, mock } from "bun:test";
import { projectionFixture as projected } from "../../support/__tests__/projection-fixtures.ts";

import { createNativeRenderer, type NativeValidation } from "../../../../../scripts/projection/src/domain/native-rendering.ts";

test("same harness at a different directory cannot install inconsistent references", () => {
  const pathStatus = mock<NativeValidation["pathStatus"]>().mockReturnValue("safe");
  const residue = mock<NativeValidation["residue"]>().mockReturnValue([]);
  const integrate = createNativeRenderer({ pathStatus, residue });
  expect(
    integrate({
      document: projected(),
      target: {
        harness: "claude",
        harnessDir: ".different",
        render: () => ({ status: "ok", value: [] }),
      },
    }),
  ).toMatchObject({ status: "invalid", findings: [{ code: "directory-mismatch" }] });
});
test("shared directories do not erase harness identity", () => {
  const pathStatus = mock<NativeValidation["pathStatus"]>().mockReturnValue("safe");
  const residue = mock<NativeValidation["residue"]>().mockReturnValue([]);
  const integrate = createNativeRenderer({ pathStatus, residue });
  expect(
    integrate({
      document: projected(),
      target: {
        harness: "cursor",
        harnessDir: ".claude",
        render: () => ({ status: "ok", value: [] }),
      },
    }),
  ).toMatchObject({ status: "invalid", findings: [{ code: "harness-mismatch" }] });
});
test("native output requires the reviewer body and hook registration together", () => {
  const pathStatus = mock<NativeValidation["pathStatus"]>().mockReturnValue("safe");
  const residue = mock<NativeValidation["residue"]>().mockReturnValue([]);
  const integrate = createNativeRenderer({ pathStatus, residue });
  expect(
    integrate({
      document: projected(),
      target: {
        harness: "claude",
        harnessDir: ".claude",
        render: () => ({
          status: "ok",
          value: [{ kind: "file", path: "reviewer.md", body: "body" }],
        }),
      },
    }),
  ).toMatchObject({ status: "invalid", findings: [{ code: "missing-registration" }] });
});
test("native output rejects unsafe paths and token residue", () => {
  const pathStatus = mock<NativeValidation["pathStatus"]>().mockReturnValue("safe");
  const residue = mock<NativeValidation["residue"]>().mockReturnValue([]);
  const integrate = createNativeRenderer({ pathStatus, residue });
  pathStatus.mockReturnValue("unsafe");
  residue.mockReturnValue([
    { code: "unresolved-token", subject: "../reviewer.md", detail: "token at line 1" },
  ]);
  expect(
    integrate({
      document: projected(),
      target: {
        harness: "claude",
        harnessDir: ".claude",
        render: () => ({
          status: "ok",
          value: [{ kind: "file", path: "../reviewer.md", body: "{{HARNESS_DIR}}" }],
        }),
      },
    }),
  ).toMatchObject({
    status: "invalid",
    findings: [
      { code: "invalid-destination" },
      { code: "unresolved-token" },
      { code: "missing-registration" },
    ],
  });
  expect(pathStatus).toHaveBeenCalledWith({ path: "../reviewer.md" });
  expect(residue).toHaveBeenCalledWith({ text: "{{HARNESS_DIR}}", subject: "../reviewer.md" });
});
