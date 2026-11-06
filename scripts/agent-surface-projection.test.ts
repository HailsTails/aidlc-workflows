// covers: function:agentSurfaceRequirements, function:projectAgentSurface

import { expect, test } from "bun:test";
import { agentSurfaceRequirements, projectAgentSurface } from "./agent-surface-projection.ts";

const document = "---\nname: product\n---\nPersona body.\n";
const path = "agents/product-agent.md";
const inlineAgents = new Set(["product-agent"]);

test("native permissions on an agent require an inline-role snapshot", () => {
  expect(agentSurfaceRequirements({ path, additions: ["permissions:", "  read: allow"] })).toEqual({
    kind: "inline-role", agent: "product-agent", personaPath: "aidlc-common/personas/product-agent.md",
  });
});

test.each([
  { path, additions: ["tools: [read, write]"] },
  { path, additions: [" permissions: nested"] },
  { path, additions: ["permissions-extra: true"] },
  { path: "knowledge/product-agent.md", additions: ["permissions: allow"] },
  { path, additions: [] },
])("ordinary metadata does not require loading inline roles: $path $additions", ({ path, additions }) => {
  expect(agentSurfaceRequirements({ path, additions })).toEqual({ kind: "dispatch-only" });
});

test("a nested agent destination retains the existing leaf-only persona path", () => {
  expect(agentSurfaceRequirements({ path: "agents/nested/product-agent.md", additions: ["permissions: allow"] })).toEqual({
    kind: "inline-role", agent: "product-agent", personaPath: "aidlc-common/personas/product-agent.md",
  });
});

test.each([
  { path: "agents/nested\nfolder/product-agent.md", agent: "product-agent", personaPath: "aidlc-common/personas/product-agent.md" },
  { path: "agents/product-agent.md\n", agent: "product-agent.md\n", personaPath: "aidlc-common/personas/product-agent.md\n" },
  { path: "agents/.md", agent: ".md", personaPath: "aidlc-common/personas/.md" },
])("the role lookup preserves native basename semantics: $path", ({ path, agent, personaPath }) => {
  expect(agentSurfaceRequirements({ path, additions: ["permissions: allow"] })).toEqual({ kind: "inline-role", agent, personaPath });
});

test("an inline lead gets its original persona before the native dispatch document", () => {
  expect(projectAgentSurface({ path, content: document, additions: ["permissions:", "  read: allow"], inlineAgents })).toEqual({
    kind: "projected", writes: [
      { kind: "persona", path: "aidlc-common/personas/product-agent.md" },
      { kind: "dispatch", path, content: "---\nname: product\npermissions:\n  read: allow\n---\nPersona body.\n" },
    ],
  });
});

test("a dispatched-only agent needs no persona even with native permissions", () => {
  expect(projectAgentSurface({ path, content: document, additions: ["permissions: allow"], inlineAgents: new Set() })).toEqual({
    kind: "projected", writes: [{ kind: "dispatch", path, content: "---\nname: product\npermissions: allow\n---\nPersona body.\n" }],
  });
});

test("a tools grant does not copy the persona even when the agent also works inline", () => {
  expect(projectAgentSurface({ path, content: document, additions: ["tools: [read]"], inlineAgents })).toEqual({
    kind: "projected", writes: [{ kind: "dispatch", path, content: "---\nname: product\ntools: [read]\n---\nPersona body.\n" }],
  });
});

test("indented permission continuation lines retain their exact spelling", () => {
  expect(projectAgentSurface({ path, content: document, additions: ["permissions:", "  shell:", '    "git *": allow'], inlineAgents })).toEqual({
    kind: "projected", writes: [
      { kind: "persona", path: "aidlc-common/personas/product-agent.md" },
      { kind: "dispatch", path, content: '---\nname: product\npermissions:\n  shell:\n    "git *": allow\n---\nPersona body.\n' },
    ],
  });
});

test.each(["Persona only.\n", "---\n---\nPersona body.\n", "\uFEFF---\nname: product\n---\nPersona body.\n"])("a missing leading metadata block refuses after preparing the persona copy: %s", (content) => {
  expect(projectAgentSurface({ path, content, additions: ["permissions: allow"], inlineAgents })).toEqual({
    kind: "refused", message: "frontmatterAdditions: agents/product-agent.md has no leading frontmatter block to extend.",
    writes: [{ kind: "persona", path: "aidlc-common/personas/product-agent.md" }],
  });
});

test("malformed metadata without a persona requirement prepares no writes", () => {
  expect(projectAgentSurface({ path, content: "Persona only.\n", additions: ["tools: read"], inlineAgents })).toEqual({
    kind: "refused", message: "frontmatterAdditions: agents/product-agent.md has no leading frontmatter block to extend.", writes: [],
  });
});

test.each([
  { additions: ["permissions: allow", "bad key: value"], message: 'frontmatterAdditions: line "bad key: value" for agents/product-agent.md does not start with a YAML key.' },
  { additions: ["permissions: allow", ""], message: 'frontmatterAdditions: line "" for agents/product-agent.md does not start with a YAML key.' },
  { additions: ["permissions: allow", "permissions: deny"], message: 'frontmatterAdditions: agents/product-agent.md declares "permissions:" more than once in additions.' },
  { additions: ["permissions: allow", "name: replacement"], message: 'frontmatterAdditions: agents/product-agent.md already declares "name:" in core - resolve the collision instead of shipping a duplicate key.' },
])("an invalid addition retains the earlier persona and its exact refusal: $message", ({ additions, message }) => {
  expect(projectAgentSurface({ path, content: document, additions, inlineAgents })).toEqual({
    kind: "refused", message, writes: [{ kind: "persona", path: "aidlc-common/personas/product-agent.md" }],
  });
});

test("validation reports the first addition failure without evaluating later keys", () => {
  expect(projectAgentSurface({ path, content: document, additions: ["name: conflict", "bad key: invalid"], inlineAgents })).toEqual({
    kind: "refused", message: 'frontmatterAdditions: agents/product-agent.md already declares "name:" in core - resolve the collision instead of shipping a duplicate key.', writes: [],
  });
});

test("an empty declared addition still inserts the legacy separator newline", () => {
  expect(projectAgentSurface({ path, content: document, additions: [], inlineAgents })).toEqual({
    kind: "projected", writes: [{ kind: "dispatch", path, content: "---\nname: product\n\n---\nPersona body.\n" }],
  });
});

test("CRLF metadata keeps its delimiters and body while inserted lines use LF", () => {
  expect(projectAgentSurface({ path, content: "---\r\nname: product\r\n---\r\nPersona body.\r\n", additions: ["tools: read"], inlineAgents })).toEqual({
    kind: "projected", writes: [{ kind: "dispatch", path, content: "---\r\nname: product\r\ntools: read\n---\r\nPersona body.\r\n" }],
  });
});

test("metadata validation does not inspect keys in the document body", () => {
  expect(projectAgentSurface({ path, content: "---\nname: product\n---\npermissions: prose\n", additions: ["permissions: allow"], inlineAgents: new Set() })).toEqual({
    kind: "projected", writes: [{ kind: "dispatch", path, content: "---\nname: product\npermissions: allow\n---\npermissions: prose\n" }],
  });
});
