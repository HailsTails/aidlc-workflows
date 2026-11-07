import {
  rendererExpectedEmitterInput,
  rendererDefinitionTextCalls,
  rendererExpectedTextCalls,
  rendererExpectedProjection,
  rendererExpectedResidueCalls,
} from "../../support/__tests__/agent-native-fixtures.ts";
import { expect, mock, test } from "bun:test";
import { claudeAgentContext, preparedMetrics } from "../../support/__tests__/agent-fixtures.ts";
import { createAgentRenderer, createAgentDefinitionRenderer, delegatedAgentPreflight } from "../../../../../scripts/projection/src/domain/agent-rendering.ts";

test("definition footprint emits the prepared native profile without claiming independent knowledge files", () => {
  const text = mock().mockReturnValueOnce("projected body").mockReturnValueOnce("projected frontmatter").mockReturnValueOnce("projected description");
  const residue = mock().mockReturnValue([]);
  const emit = mock().mockReturnValue({ status: "ok", value: [{ kind: "file", path: ".claude/agents/test-pro-metrics-agent.md", body: "native persona" }] });
  expect(createAgentDefinitionRenderer({ rules: { text, residue }, emitter: { emit } }).render(preparedMetrics)).toEqual({ status: "ok", value: { origin: preparedMetrics.agent.origin, harness: "claude", resources: [{ kind: "file", path: ".claude/agents/test-pro-metrics-agent.md", body: "native persona" }], participation: preparedMetrics.participation } });
  expect(emit).toHaveBeenCalledWith(rendererExpectedEmitterInput);
  expect(text.mock.calls).toEqual(rendererDefinitionTextCalls);
  expect(residue).toHaveBeenCalledWith({ text: "native persona", subject: ".claude/agents/test-pro-metrics-agent.md" });
});

test("renderer supplies projected content to a native emitter and collects knowledge", () => {
  const text = mock()
    .mockReturnValueOnce("projected body")
    .mockReturnValueOnce("projected frontmatter")
    .mockReturnValueOnce("projected description")
    .mockReturnValueOnce("projected methodology");
  const residue = mock().mockReturnValue([]);
  const emit = mock().mockReturnValue({
    status: "ok",
    value: [
      { kind: "file", path: ".claude/agents/test-pro-metrics-agent.md", body: "native persona" },
    ],
  });
  const projected = createAgentRenderer({ rules: { text, residue }, emitter: { emit } }).render(
    preparedMetrics,
  );
  expect(emit).toHaveBeenCalledWith(rendererExpectedEmitterInput);
  expect(text.mock.calls).toEqual(rendererExpectedTextCalls);
  expect(projected).toEqual(rendererExpectedProjection);
  expect(residue.mock.calls).toEqual(rendererExpectedResidueCalls);
});
test("renderer refuses partial emission on residue in knowledge", () => {
  const text = mock().mockReturnValue("projected");
  const refusal = {
    code: "unresolved-token",
    subject: ".claude/knowledge/test-pro-metrics-agent/methodology.md",
    detail: "{{TOOL_PREFIX}} at line 1",
  } as const;
  const residue = mock().mockReturnValueOnce([]).mockReturnValueOnce([refusal]);
  const emit = mock().mockReturnValue({
    status: "ok",
    value: [{ kind: "file", path: ".claude/agents/test-pro-metrics-agent.md", body: "native" }],
  });
  expect(
    createAgentRenderer({ rules: { text, residue }, emitter: { emit } }).render(preparedMetrics),
  ).toEqual({ status: "invalid", findings: [refusal] });
});
test("native capability refusals stop before knowledge emission", () => {
  const text = mock().mockReturnValue("projected");
  const residue = mock();
  const refusal = {
    status: "invalid",
    findings: [
      {
        code: "capability-gap",
        subject: "test-pro-metrics-agent",
        detail: "native profile unavailable",
      },
    ],
  } as const;
  const emit = mock().mockReturnValue(refusal);
  expect(
    createAgentRenderer({ rules: { text, residue }, emitter: { emit } }).render(preparedMetrics),
  ).toEqual(refusal);
  expect(text).toHaveBeenCalledTimes(3);
  expect(residue).not.toHaveBeenCalled();
});
test("knowledge cannot hide an empty native persona emission", () => {
  const text = mock().mockReturnValue("projected");
  const residue = mock();
  const emit = mock().mockReturnValue({ status: "ok", value: [] });
  expect(
    createAgentRenderer({ rules: { text, residue }, emitter: { emit } }).render(preparedMetrics),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "missing-body",
        subject: "test-pro-metrics-agent",
        detail: "native agent emitter must produce a persona file",
      },
    ],
  });
  expect(text).toHaveBeenCalledTimes(3);
  expect(residue).not.toHaveBeenCalled();
});
test("methodology-only preflight retains ordered sources and format exclusions", () => {
  expect(
    delegatedAgentPreflight({
      name: "test-pro-metrics-agent",
      context: { ...claudeAgentContext, sharedKnowledge: "methodology-only" },
    }),
  ).toEqual(
    "<!-- aidlc-delegated-knowledge-preflight -->\n**Delegated knowledge preflight (mandatory):** Before substantive work, ensure every readable Markdown file under these directories is loaded, in order: `.claude/knowledge/aidlc-shared/` (all but its format references `audit-format.md`, `knowledge-readme-template.md`, `memory-template.md`, `state-template.md` and `worktree-info-schema.md`: a step that needs one names it), `.claude/knowledge/test-pro-metrics-agent/`, `aidlc/spaces/<active-space>/knowledge/aidlc-shared/`, then `aidlc/spaces/<active-space>/knowledge/test-pro-metrics-agent/`. A native resource preload satisfies this requirement; otherwise read the files now. The dispatch brief supplies rules and artifact paths separately.",
  );
});
