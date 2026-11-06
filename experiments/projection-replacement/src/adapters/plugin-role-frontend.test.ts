import { expect, test } from "bun:test";
import { createPluginRoleFrontend } from "./plugin-role-frontend.ts";
import { createRoleFrontendFixture, roleDocument, roleFrontend, roleStage, roleFrontendReply } from "../../__tests__/plugin-role-fixtures.ts";

test("source frontend returns bound roles and releases its isolated process home", async () => {
  const fixture = createRoleFrontendFixture();
  expect(await createPluginRoleFrontend(fixture).read({ documents: [roleDocument] })).toEqual({ status: "ok", value: { frontend: roleFrontend, stages: [roleStage] } });
  expect(fixture.directories.remove).toHaveBeenCalledTimes(1);
});
test("missing source frontend remains an availability finding", async () => {
  const fixture = createRoleFrontendFixture();
  fixture.operations.spawn.mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: JSON.stringify({ status: "unavailable", detail: "source API absent" }) });
  expect(await createPluginRoleFrontend(fixture).read({ documents: [roleDocument] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "plugin-role-frontend", detail: "source API absent" }] });
  expect(fixture.directories.remove).toHaveBeenCalledTimes(1);
});
test("foreign source text cannot reuse a frontend reply", async () => {
  const fixture = createRoleFrontendFixture();
  fixture.digest.mockReturnValue("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
  expect(await createPluginRoleFrontend(fixture).read({ documents: [roleDocument] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-role-frontend", detail: "role declarations must match every requested source path and input byte string, with both frontend entrypoint witnesses" }] });
});
test("an accepted body cannot bypass missing parser witnesses", async () => {
  const fixture = createRoleFrontendFixture();
  fixture.operations.spawn.mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: JSON.stringify({ ...roleFrontendReply, inputs: [] }) });
  expect(await createPluginRoleFrontend(fixture).read({ documents: [roleDocument] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-role-frontend", detail: "role declarations must match every requested source path and input byte string, with both frontend entrypoint witnesses" }] });
});
test("native grammar diagnostics remain explicit input refusals", async () => {
  const fixture = createRoleFrontendFixture();
  fixture.operations.spawn.mockReturnValue({ exitCode: 0, error: null, stderr: "", stdout: JSON.stringify({ status: "refused", detail: "stage: mode is required" }) });
  expect(await createPluginRoleFrontend(fixture).read({ documents: [roleDocument] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "plugin-role-frontend", detail: "stage: mode is required" }] });
});
test("unsafe source addresses refuse before launching the source process", async () => {
  const fixture = createRoleFrontendFixture();
  expect(await createPluginRoleFrontend(fixture).read({ documents: [{ ...roleDocument, origin: { ...roleDocument.origin, path: "../outside.md" } }] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "plugin-role-frontend", detail: "use a trusted framework frontend and nonempty unique plugin stage source documents" }] });
  expect(fixture.operations.spawn).not.toHaveBeenCalled();
  expect(fixture.directories.remove).toHaveBeenCalledTimes(1);
});
