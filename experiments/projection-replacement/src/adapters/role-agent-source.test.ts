import { expect, mock, test } from "bun:test";
import { parseRoleAgentSource } from "./role-agent-source.ts";
import { metricsSource, metricsAgent, agentOrigin, malformedMetricsSource } from "../../__tests__/agent-fixtures.ts";

test("composition: existing authored parser preserves model-only policy and hashes exact source", () => {
  const digest = mock().mockReturnValue("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  expect(parseRoleAgentSource({ text: metricsSource, origin: agentOrigin, digest })).toEqual({ status: "ok", value: { agent: metricsAgent, sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } });
  expect(digest).toHaveBeenCalledWith({ bytes: new TextEncoder().encode(metricsSource) });
});
test("composition: invalid authored metadata cannot acquire a role source digest", () => {
  const digest = mock().mockReturnValue("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  expect(parseRoleAgentSource({ text: malformedMetricsSource, origin: agentOrigin, digest })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "frontmatter", detail: "expected valid YAML with unique mapping keys" }] });
  expect(digest).not.toHaveBeenCalled();
});
