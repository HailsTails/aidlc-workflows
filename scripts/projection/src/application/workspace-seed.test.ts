import { expect, mock, test } from "bun:test";
import { prepareWorkspaceSeedInput } from "./workspace-seed.ts";
import { workspaceSeedSource, workspaceSeedPrepared } from "../../../../tests/unit/projection/support/__tests__/workspace-seed-fixtures.ts";

test("prepares one source-owned seed input with mode and direct source witness", () => {
  const encode = mock().mockReturnValue(new Uint8Array([100, 101, 102, 97, 117, 108, 116, 10]));
  expect(prepareWorkspaceSeedInput({ source: workspaceSeedSource, mode: 0o640, encode })).toEqual({ status: "ok", value: workspaceSeedPrepared });
  expect(encode.mock.calls).toEqual([[{ text: "default\n" }]]);
});

test.each([{ mode: -1 }, { mode: 0o1000 }, { mode: 1.5 }])("invalid file mode $mode refuses before encoding", ({ mode }) => {
  const encode = mock();
  expect(prepareWorkspaceSeedInput({ source: workspaceSeedSource, mode, encode })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "workspace-seed", detail: "fresh workspace seed requires a file mode between 0 and 0777" }] });
  expect(encode).not.toHaveBeenCalled();
});

test("zero file mode is retained rather than replaced with a default", () => {
  expect(prepareWorkspaceSeedInput({ source: workspaceSeedSource, mode: 0, encode: mock().mockReturnValue(new Uint8Array([1])) })).toEqual({ status: "ok", value: { files: [{ path: "aidlc/active-space", bytes: new Uint8Array([1]), mode: 0 }], preparation: { kind: "workspace-seed", paths: ["aidlc/active-space"], inputs: [{ path: "scripts/workspace-seed.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] } } });
});
