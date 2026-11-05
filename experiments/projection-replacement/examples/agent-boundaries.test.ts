import { expect, test } from "bun:test";
import {
  agentOrigin,
  metricsSource,
  indentedMetricsSource,
  duplicateIndentedMetricsSource,
  cursorAgentContext,
  claudeAgentContext,
} from "../__tests__/agent-fixtures.ts";
import { kasPolicy } from "../__tests__/agent-native-fixtures.ts";
import { successful } from "../__tests__/support.ts";
import { projectAuthoredAgent } from "./agent-projection.ts";
import { parseKasWorkerPolicy } from "../src/adapters/kas-agent.ts";

test("composition: legitimate YAML indentation obeys Cursor inheritance and preserves Claude explicit models", () => {
  const cursor = successful(
    projectAuthoredAgent({
      text: indentedMetricsSource,
      origin: agentOrigin,
      context: cursorAgentContext,
      knowledge: [],
      stages: [],
    }),
  );
  expect(cursor).toEqual(
    successful(
      projectAuthoredAgent({
        text: metricsSource,
        origin: agentOrigin,
        context: cursorAgentContext,
        knowledge: [],
        stages: [],
      }),
    ),
  );
  expect(cursor.resources[0]?.body).not.toContain("model: sonnet");
  const claude = successful(
    projectAuthoredAgent({
      text: indentedMetricsSource,
      origin: agentOrigin,
      context: claudeAgentContext,
      knowledge: [],
      stages: [],
    }),
  );
  expect(claude.resources[0]?.body).toContain("model: sonnet");
});
test("composition: indented duplicate models fail before any native resources are produced", () => {
  expect(
    projectAuthoredAgent({
      text: duplicateIndentedMetricsSource,
      origin: agentOrigin,
      context: cursorAgentContext,
      knowledge: [],
      stages: [],
    }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "invalid-input",
        subject: "frontmatter",
        detail: "expected valid YAML with unique mapping keys",
      },
    ],
  });
});
test.each([
  [
    'tools: ["read", "write", "shell"]',
    "includeMcpJson: true",
    'tools: ["read", "write", "shell", "agent"]',
  ],
  ['tools: ["read", "write", "shell"]', "includeMcpJson: true", "permissions: ["],
  ['tools: ["read", "write", "shell"]', "permissions:", "  rules: []", "  rules: []"],
])("composition: KAS rejects overriding and malformed native tails", (...lines) => {
  expect(
    parseKasWorkerPolicy({ input: lines, origin: kasPolicy.origin, name: kasPolicy.name }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "invalid-input",
        subject: "frontmatter",
        detail: "expected valid YAML with unique mapping keys",
      },
    ],
  });
});
test("composition: KAS retains a real native deny rule after complete validation", () => {
  const lines = [
    'tools: ["read", "write", "shell"]',
    "permissions:",
    "  rules:",
    "    - capability: shell",
    "      effect: deny",
    '      match: ["engine transition *"]',
  ];
  expect(
    parseKasWorkerPolicy({ input: lines, origin: kasPolicy.origin, name: kasPolicy.name }),
  ).toEqual({ status: "ok", value: { origin: kasPolicy.origin, name: kasPolicy.name, lines, contract: { tools: ["read", "write", "shell"], permissions: { rules: [{ capability: "shell", effect: "deny", match: ["engine transition *"] }] } } } });
});
