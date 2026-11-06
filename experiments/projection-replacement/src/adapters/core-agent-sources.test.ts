import { expect, mock, test } from "bun:test";
import { createCoreAgentSourceReader } from "./core-agent-sources.ts";
import { coreAgent, coreAgentOrigin, coreAgentBasis, coreAgentInputs, createCoreAgentSourceFixture } from "../../__tests__/core-agent-fixtures.ts";
test("admits inventory and delegates authored metadata exactly once with its origin", async () => {
  const operations = createCoreAgentSourceFixture();
  expect(await createCoreAgentSourceReader({ operations }).load({ sourceRoot: "source", basis: coreAgentBasis })).toEqual({ status: "ok", value: coreAgentInputs.agents });
  expect(operations.inventory).toHaveBeenCalledWith({ sourceRoot: "source" });
  expect(operations.parse).toHaveBeenCalledWith({ text: "Source", origin: coreAgentOrigin });
  expect(operations.parse).toHaveBeenCalledTimes(1);
  expect(operations.digest).toHaveBeenCalledWith({ bytes: new Uint8Array([83, 111, 117, 114, 99, 101]) });
});
test.each([
  [[]],
  [[{ path: "core/agents/aidlc-note-agent/helper.ts", text: "asset" }]],
  [[{ path: "plugins/rin/agents/aidlc-note-agent.md", text: "Source" }]],
])("unsupported inventory stops before descriptor parsing", async (inventory) => {
  const operations = { ...createCoreAgentSourceFixture(), inventory: mock().mockResolvedValue(inventory) };
  expect(await createCoreAgentSourceReader({ operations }).load({ sourceRoot: "source", basis: coreAgentBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-agent-sources", detail: "read a nonempty inventory of core/agents/<name>-agent.md; unsupported entries were not discarded" }] });
  expect(operations.parse).not.toHaveBeenCalled();
});
test("duplicate paths cannot silently acquire two agent identities", async () => {
  const operations = { ...createCoreAgentSourceFixture(), inventory: mock().mockResolvedValue([{ path: "core/agents/aidlc-note-agent.md", text: "Source" }, { path: "core/agents/aidlc-note-agent.md", text: "Other" }]) };
  expect(await createCoreAgentSourceReader({ operations }).load({ sourceRoot: "source", basis: coreAgentBasis })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "core-agent-sources", detail: "authored agent paths must be unique before parsing" }] });
  expect(operations.parse).not.toHaveBeenCalled();
});
test("authored metadata refusal remains data without manufacturing a partial agent set", async () => {
  const operations = { ...createCoreAgentSourceFixture(), inventory: mock().mockResolvedValue([{ path: "core/agents/aidlc-note-agent.md", text: "Source" }, { path: "core/agents/aidlc-other-agent.md", text: "Other" }]), parse: mock().mockReturnValueOnce({ status: "ok", value: coreAgent }).mockReturnValueOnce({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/agents/aidlc-other-agent.md", detail: "authored policy unsupported" }] }) };
  expect(await createCoreAgentSourceReader({ operations }).load({ sourceRoot: "source", basis: coreAgentBasis })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core/agents/aidlc-other-agent.md", detail: "authored policy unsupported" }] });
  expect(operations.parse).toHaveBeenNthCalledWith(2, { text: "Other", origin: { ...coreAgentBasis, path: "core/agents/aidlc-other-agent.md" } });
  expect(operations.digest).not.toHaveBeenCalled();
});
test("inventory unavailability is distinguished from authored policy refusal", async () => {
  const operations = { ...createCoreAgentSourceFixture(), inventory: mock().mockRejectedValue(new Error("private source path")) };
  expect(await createCoreAgentSourceReader({ operations }).load({ sourceRoot: "source", basis: coreAgentBasis })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core-agent-sources", detail: "authored agent inventory or parser capability unavailable" }] });
  expect(operations.parse).not.toHaveBeenCalled();
});
test("foreign ownership refuses before any inventory is read", async () => {
  const operations = createCoreAgentSourceFixture();
  expect(await createCoreAgentSourceReader({ operations }).load({ sourceRoot: "source", basis: { source: { kind: "plugin", id: "rin" }, pin: coreAgentBasis.pin } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-agent-sources", detail: "declare the framework source basis before reading authored core agents" }] });
  expect(operations.inventory).not.toHaveBeenCalled();
});
