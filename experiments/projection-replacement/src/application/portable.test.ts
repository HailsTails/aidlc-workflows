import { expect, test, mock } from "bun:test";
import { createPortableProjector, type PortableProjectorInput } from "./portable.ts";
test.each([
  { json: '{"contract":{"harness":"claude"}}', decoded: { contract: { harness: "claude" } } },
  { json: "null", decoded: null },
  { json: '"authored"', decoded: "authored" },
])("portable JSON delegates $json to its projection boundary", ({ json, decoded }) => {
  const projected = { status: "ok", value: [] } as const;
  const projectInput = mock<PortableProjectorInput["projectInput"]>().mockReturnValue(projected);
  const projectPortable = createPortableProjector({ projectInput });
  expect(projectPortable({ json })).toBe(projected);
  expect(projectInput).toHaveBeenCalledTimes(1);
  expect(projectInput).toHaveBeenCalledWith({ input: decoded });
});
test("portable boundary preserves a controlled invalid projection outcome", () => {
  const invalid = {
    status: "invalid",
    findings: [{ code: "capability-gap", subject: "controlled", detail: "delegate refuses" }],
  } as const;
  const projectInput = mock<PortableProjectorInput["projectInput"]>().mockReturnValue(invalid);
  expect(createPortableProjector({ projectInput })({ json: "{}" })).toBe(invalid);
  expect(projectInput).toHaveBeenCalledWith({ input: {} });
});
test("malformed JSON returns a finding before invoking projection", () => {
  const projectInput = mock<PortableProjectorInput["projectInput"]>();
  const projectPortable = createPortableProjector({ projectInput });
  expect(projectPortable({ json: "{" })).toEqual({
    status: "invalid",
    findings: [
      {
        code: "invalid-json",
        subject: "portable-input",
        detail: "expected JSON projection request",
      },
    ],
  });
  expect(projectInput).not.toHaveBeenCalled();
});
