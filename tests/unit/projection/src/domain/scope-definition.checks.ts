import { expect, test } from "bun:test";
import { renderScopeDefinition, bindScopeInputs } from "../../../../../scripts/projection/src/domain/scope-definition.ts";
import { authoredScope, scopeContext, scopeProjection, scopeSources, scopeWorkflow } from "../../support/__tests__/scope-fixtures.ts";
test("shared engine scope placement preserves authored native frontmatter", () => {
  expect(renderScopeDefinition({ scope: authoredScope, context: scopeContext })).toEqual({ status: "ok", value: scopeProjection });
});
test("scope prose follows native harness substitutions and preserves native permission-file references", () => {
  expect(renderScopeDefinition({ scope: { ...authoredScope, markdown: "{{HARNESS_DIR}}/rules/testing.md .codex/rules/default.rules other/rules/testing.md {{INVOKE}}\n" }, context: { harness: "codex", directory: ".codex", rulesSubdir: "aidlc-rules", invocation: "bun .codex/tools/aidlc.ts" } })).toEqual({ status: "ok", value: { origin: authoredScope.origin, name: "bugfix", harness: "codex", resources: [{ kind: "file", path: ".codex/scopes/aidlc-bugfix.md", body: ".codex/aidlc-rules/testing.md .codex/rules/default.rules other/rules/testing.md bun .codex/tools/aidlc.ts\n" }] } });
});
test("unsupported source tokens remain explicit capability failures", () => {
  expect(renderScopeDefinition({ scope: { ...authoredScope, markdown: "{{TOOL_PREFIX}}status" }, context: scopeContext })).toEqual({ status: "invalid", findings: [{ code: "unresolved-token", subject: ".claude/scopes/aidlc-bugfix.md", detail: "{{TOOL_PREFIX}} at line 1" }] });
});
test("scope input binding accepts the exact independently compiled inventory", () => {
  expect(bindScopeInputs({ sources: scopeSources, workflow: scopeWorkflow })).toEqual({ status: "ok", value: scopeSources });
});
test("a same-name changed scope cannot disagree with the grid compiler input", () => {
  expect(bindScopeInputs({ sources: { ...scopeSources, inputs: [{ path: "core/scopes/aidlc-bugfix.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] }, workflow: scopeWorkflow })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "scope-sources", detail: "authored scope inventory and bytes must match the workflow compiler's scope witnesses; retry from stable source inputs" }] });
});
test("an omitted scope cannot masquerade as complete source preparation", () => {
  expect(bindScopeInputs({ sources: { scopes: [], inputs: [] }, workflow: scopeWorkflow })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "scope-sources", detail: "authored scope inventory and bytes must match the workflow compiler's scope witnesses; retry from stable source inputs" }] });
});
