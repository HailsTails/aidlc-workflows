// covers: file:scripts/projection/src/adapters/qualified-harness-profile.ts, file:scripts/projection/src/adapters/codex-agent.ts
import { expect, test } from "bun:test";
import { qualifiedDeliveryContext, qualifiedHarnessProfile } from "../../scripts/projection/src/adapters/qualified-harness-profile.ts";
import { selectCoreSensorProducts } from "../../scripts/projection/examples/core-sensor-products.ts";
import { selectHarnessDocumentProducts } from "../../scripts/projection/examples/harness-document-products.ts";
import { createCodexAgentEmitter } from "../../scripts/projection/src/adapters/codex-agent.ts";
import { renderHarnessDocument } from "../../scripts/projection/src/domain/harness-document.ts";
const basis = { source: { kind: "core", id: "framework" }, pin: "a".repeat(40) } as const;
const binding = { harness: "codex", directory: ".codex" } as const;

test("host model invocation is separate from copy and native executable delivery", () => {
  expect(qualifiedHarnessProfile(binding)?.modelInvocation).toBe("disabled");
  expect(qualifiedHarnessProfile({ harness: "claude", directory: ".claude" })?.modelInvocation).toBe("native-default");
  for (const invocation of ["aidlc", "bun .codex/tools/aidlc.ts"]) expect(qualifiedDeliveryContext({ ...binding, invocation })).toBe(true);
  expect(qualifiedDeliveryContext({ ...binding, invocation: "bun .claude/tools/aidlc.ts" })).toBe(false);
});
test.each(["aidlc", "bun .kiro/tools/aidlc.ts"])("unqualified source-host sensor selection refuses %s", invocation => {
  expect(selectCoreSensorProducts({ basis, sources: { inputs: [], documents: [{ fileName: "aidlc-example.md", origin: { ...basis, path: "core/sensors/aidlc-example.md" }, text: "content" }] }, context: { harness: "kiro", directory: ".kiro", invocation, rulesSubdir: "rules" } }).status).toBe("invalid");
});
test("Codex turn cap stays in Markdown and is explicitly prose-only in TOML", () => {
  const result = createCodexAgentEmitter().emit({ origin: { ...basis, path: "core/agents/aidlc-review-agent.md" }, binding, name: "aidlc-review-agent", description: "Review", frontmatter: "name: aidlc-review-agent\nmaxTurns: 17", body: "Use the `maxTurns: 17` frontmatter above - keep the two numbers in sync", preflight: "Read first", nativeModel: { model: null, effort: "medium" }, policy: { ambientInstructions: "inherit", tools: { kind: "inherit" }, turnLimit: 17 } });
  expect(result.status).toBe("ok");
  if (result.status !== "ok") return;
  const toml = result.value.find(file => file.path.endsWith(".toml"))?.body;
  const markdown = result.value.find(file => file.path.endsWith(".md"))?.body;
  expect(toml).toContain("prose-only here; update it by hand if the authored cap changes");
  expect(toml).toContain("model_reasoning_effort = \"medium\"");
  expect(toml).not.toContain("\nmodel =");
  expect(markdown).toContain("maxTurns: 17");
});
test("prepared split documents retain one explicit safe destination", () => {
  const document = { binding, destination: "AGENTS.md", authored: { role: "onboarding", origin: { ...basis, path: "core/templates/onboarding.md" }, text: "source" }, text: "prepared", authoring: [] } as const;
  expect(renderHarnessDocument({ document, context: binding })).toMatchObject({ status: "ok", value: { resources: [{ path: "AGENTS.md", body: "prepared" }] } });
  expect(renderHarnessDocument({ document: { ...document, destination: "../escape" }, context: binding }).status).toBe("invalid");
  expect(renderHarnessDocument({ document, context: { harness: "claude", directory: ".claude" } }).status).toBe("invalid");
});

test.each([".unmanaged/foreign.md", ".codex/agents/aidlc-other.md", ".agents/skills/aidlc/SKILL.md"])("entry role cannot substitute a safe destination or source: %s", destination => {
  const documents = qualifiedHarnessProfile(binding)!.entryDocuments.map(placement => ({ binding, destination: placement.destination, authored: { role: placement.role, origin: { ...basis, path: `harness/codex/${placement.source}` }, text: "source" }, text: "prepared", authoring: ["harness/codex/manifest.ts", "scripts/earlier-release-regions.ts"].map(path => ({ ...basis, path })) }));
  expect(selectHarnessDocumentProducts({ sources: { documents, inputs: [] }, basis, context: binding }).status).toBe("ok");
  const first = documents[0]!;
  const changed = destination === first.destination ? { ...first, authored: { ...first.authored, origin: { ...first.authored.origin, path: "harness/codex/foreign.md" } } } : { ...first, destination };
  expect(selectHarnessDocumentProducts({ sources: { documents: [changed, ...documents.slice(1)], inputs: [] }, basis, context: binding }).status).toBe("invalid");
});
