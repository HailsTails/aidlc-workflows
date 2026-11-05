import { expect, test } from "bun:test";
import { preparationFixture } from "../../__tests__/projection-fixtures.ts";
import { sensorRenderingCases } from "../../__tests__/sensor-cases.ts";
import { first, successful } from "../../__tests__/support.ts";
import { renderProjection, residue } from "./projection-content.ts";
test("authored descriptions receive content projection", () => {
  expect(
    successful(
      renderProjection(
        preparationFixture({ document: { description: "Review {{HARNESS_DIR}} context" } }),
      ),
    ).description,
  ).toBe("Review .claude context");
});
test("body and absorbed knowledge receive rules, memory and invocation projection", () => {
  expect(successful(renderProjection(preparationFixture())).body).toBe(
    "Review using .claude/guardrails/ and aidlc/spaces/default/memory. Run aidlc. Literal template: {{ customer.name }}.\n\n---\n\nCheck evidence against .claude/guardrails/review.md.",
  );
});
test.each([
  "run $$ sentinel",
  "run $$ sentinel $& $` $'",
])("replacement preserves literal invocation %s", (invocation) => {
  expect(
    successful(
      renderProjection(
        preparationFixture({
          contract: { invocation },
          document: {
            body: "{{AIDLC_INVOKE}}",
            hook: { event: "session-start", command: "{{AIDLC_INVOKE}}" },
          },
          absorbedKnowledge: [],
        }),
      ),
    ),
  ).toMatchObject({ body: invocation, hook: { command: invocation } });
});
test("text projection is independent of filename extensions", () => {
  expect(
    successful(
      renderProjection(
        preparationFixture({
          document: {
            kind: "text",
            tier: null,
            description: null,
            knowledge: [],
            hook: null,
            body: '{"dir":"{{HARNESS_DIR}}"}',
          },
          absorbedKnowledge: [],
        }),
      ),
    ).body,
  ).toBe('{"dir":".claude"}');
});
test("opaque assets preserve literal braces", () => {
  expect(
    successful(
      renderProjection(
        preparationFixture({
          document: { kind: "asset", body: "literal {{ braces }}" },
          absorbedKnowledge: [],
        }),
      ),
    ).body,
  ).toBe("literal {{ braces }}");
});
test("opaque assets refuse reserved tokens with line findings", () => {
  expect(
    renderProjection(
      preparationFixture({
        document: { kind: "asset", body: "first\n{{HARNESS_DIR}}", description: null, hook: null },
        absorbedKnowledge: [],
      }),
    ),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "unresolved-token",
        subject: "plugin:test-pro/reviewer",
        detail: "{{HARNESS_DIR}} at line 2",
      },
    ],
  });
});
test("residue introduced by a replacement is rejected", () => {
  expect(
    renderProjection(preparationFixture({ contract: { invocation: "{{HARNESS_DIR}}" } })),
  ).toMatchObject({ status: "invalid", findings: [{ code: "unresolved-token" }] });
});
test("residue reports all recognized tokens without rejecting ordinary templates", () => {
  expect(
    residue({ text: "{{ customer.name }}\n{{AIDLC_INVOKE}} {{MEMORY_ROOT}}", subject: "review" }),
  ).toEqual([
    { code: "unresolved-token", subject: "review", detail: "{{AIDLC_INVOKE}} at line 2" },
    { code: "unresolved-token", subject: "review", detail: "{{MEMORY_ROOT}} at line 2" },
  ]);
});

test("maintained sensor invocation token is projected literally", () => {
  expect(
    successful(
      renderProjection(
        preparationFixture({
          document: { kind: "text", body: "command: {{INVOKE}} engine sensor-linter", hook: null },
          absorbedKnowledge: [],
          contract: { invocation: "bun .claude/tools/aidlc.ts" },
        }),
      ),
    ).body,
  ).toBe("command: bun .claude/tools/aidlc.ts engine sensor-linter");
});

test.each([
  "{{TOOL_PREFIX}}",
  "{{TRUSTED_NAMESPACE}}",
  "{{OPTION_LETTERS}}",
])("unsupported maintained context %s refuses incomplete projection", (token) => {
  expect(
    renderProjection(
      preparationFixture({
        document: { kind: "text", body: token, hook: null },
        absorbedKnowledge: [],
      }),
    ),
  ).toMatchObject({ status: "invalid", findings: [{ code: "unresolved-token" }] });
});

test("projected content freezes copied tier facts", () => {
  const document = successful(renderProjection(preparationFixture()));
  expect(Object.isFrozen(document.nativeTier)).toBe(true);
  expect(Object.isFrozen(document.source)).toBe(true);
});

test.each([
  ...sensorRenderingCases,
])("real descriptor rendering: $baseline $channel $harness $kind", ({ input, expected }) => {
  expect(
    renderProjection({
      document: first({ entries: input.documents }),
      contract: input.contract,
      absorbedKnowledge: [],
      nativeTier: null,
    }),
  ).toEqual({ status: "ok", value: expected });
});

test.each([
  {
    contract: { harnessDir: "{{HARNESS_DIR}}" },
    authored: "{{HARNESS_DIR}}",
    detail: "{{HARNESS_DIR}} at line 1",
  },
  {
    contract: { harnessDir: "{{AIDLC_INVOKE}}" },
    authored: "{{HARNESS_DIR}}",
    detail: "{{AIDLC_INVOKE}} at line 1",
  },
  {
    contract: { harnessDir: "{{INVOKE}}" },
    authored: "{{HARNESS_DIR}}",
    detail: "{{INVOKE}} at line 1",
  },
  {
    contract: { harnessDir: "{{MEMORY_ROOT}}" },
    authored: "{{HARNESS_DIR}}",
    detail: "{{MEMORY_ROOT}} at line 1",
  },
  {
    contract: { harnessDir: "{{TOOL_PREFIX}}" },
    authored: "{{HARNESS_DIR}}",
    detail: "{{TOOL_PREFIX}} at line 1",
  },
  {
    contract: { harnessDir: "{{TRUSTED_NAMESPACE}}" },
    authored: "{{HARNESS_DIR}}",
    detail: "{{TRUSTED_NAMESPACE}} at line 1",
  },
  {
    contract: { harnessDir: "{{OPTION_LETTERS}}" },
    authored: "{{HARNESS_DIR}}",
    detail: "{{OPTION_LETTERS}} at line 1",
  },
  {
    contract: { rulesSubdir: "{{HARNESS_DIR}}" },
    authored: "{{HARNESS_DIR}}/rules/",
    detail: "{{HARNESS_DIR}} at line 1",
  },
  {
    contract: { rulesSubdir: "{{AIDLC_INVOKE}}" },
    authored: "{{HARNESS_DIR}}/rules/",
    detail: "{{AIDLC_INVOKE}} at line 1",
  },
  {
    contract: { rulesSubdir: "{{INVOKE}}" },
    authored: "{{HARNESS_DIR}}/rules/",
    detail: "{{INVOKE}} at line 1",
  },
  {
    contract: { rulesSubdir: "{{MEMORY_ROOT}}" },
    authored: "{{HARNESS_DIR}}/rules/",
    detail: "{{MEMORY_ROOT}} at line 1",
  },
  {
    contract: { rulesSubdir: "{{TOOL_PREFIX}}" },
    authored: "{{HARNESS_DIR}}/rules/",
    detail: "{{TOOL_PREFIX}} at line 1",
  },
  {
    contract: { rulesSubdir: "{{TRUSTED_NAMESPACE}}" },
    authored: "{{HARNESS_DIR}}/rules/",
    detail: "{{TRUSTED_NAMESPACE}} at line 1",
  },
  {
    contract: { rulesSubdir: "{{OPTION_LETTERS}}" },
    authored: "{{HARNESS_DIR}}/rules/",
    detail: "{{OPTION_LETTERS}} at line 1",
  },
  {
    contract: { invocation: "{{HARNESS_DIR}}" },
    authored: "{{AIDLC_INVOKE}}",
    detail: "{{HARNESS_DIR}} at line 1",
  },
  {
    contract: { invocation: "{{AIDLC_INVOKE}}" },
    authored: "{{AIDLC_INVOKE}}",
    detail: "{{AIDLC_INVOKE}} at line 1",
  },
  {
    contract: { invocation: "{{INVOKE}}" },
    authored: "{{AIDLC_INVOKE}}",
    detail: "{{INVOKE}} at line 1",
  },
  {
    contract: { invocation: "{{MEMORY_ROOT}}" },
    authored: "{{AIDLC_INVOKE}}",
    detail: "{{MEMORY_ROOT}} at line 1",
  },
  {
    contract: { invocation: "{{TOOL_PREFIX}}" },
    authored: "{{AIDLC_INVOKE}}",
    detail: "{{TOOL_PREFIX}} at line 1",
  },
  {
    contract: { invocation: "{{TRUSTED_NAMESPACE}}" },
    authored: "{{AIDLC_INVOKE}}",
    detail: "{{TRUSTED_NAMESPACE}} at line 1",
  },
  {
    contract: { invocation: "{{OPTION_LETTERS}}" },
    authored: "{{AIDLC_INVOKE}}",
    detail: "{{OPTION_LETTERS}} at line 1",
  },
  {
    contract: { invocation: "{{HARNESS_DIR}}" },
    authored: "{{INVOKE}}",
    detail: "{{HARNESS_DIR}} at line 1",
  },
  {
    contract: { invocation: "{{AIDLC_INVOKE}}" },
    authored: "{{INVOKE}}",
    detail: "{{AIDLC_INVOKE}} at line 1",
  },
  {
    contract: { invocation: "{{INVOKE}}" },
    authored: "{{INVOKE}}",
    detail: "{{INVOKE}} at line 1",
  },
  {
    contract: { invocation: "{{MEMORY_ROOT}}" },
    authored: "{{INVOKE}}",
    detail: "{{MEMORY_ROOT}} at line 1",
  },
  {
    contract: { invocation: "{{TOOL_PREFIX}}" },
    authored: "{{INVOKE}}",
    detail: "{{TOOL_PREFIX}} at line 1",
  },
  {
    contract: { invocation: "{{TRUSTED_NAMESPACE}}" },
    authored: "{{INVOKE}}",
    detail: "{{TRUSTED_NAMESPACE}} at line 1",
  },
  {
    contract: { invocation: "{{OPTION_LETTERS}}" },
    authored: "{{INVOKE}}",
    detail: "{{OPTION_LETTERS}} at line 1",
  },
  {
    contract: { memoryRoot: "{{HARNESS_DIR}}" },
    authored: "{{MEMORY_ROOT}}",
    detail: "{{HARNESS_DIR}} at line 1",
  },
  {
    contract: { memoryRoot: "{{AIDLC_INVOKE}}" },
    authored: "{{MEMORY_ROOT}}",
    detail: "{{AIDLC_INVOKE}} at line 1",
  },
  {
    contract: { memoryRoot: "{{INVOKE}}" },
    authored: "{{MEMORY_ROOT}}",
    detail: "{{INVOKE}} at line 1",
  },
  {
    contract: { memoryRoot: "{{MEMORY_ROOT}}" },
    authored: "{{MEMORY_ROOT}}",
    detail: "{{MEMORY_ROOT}} at line 1",
  },
  {
    contract: { memoryRoot: "{{TOOL_PREFIX}}" },
    authored: "{{MEMORY_ROOT}}",
    detail: "{{TOOL_PREFIX}} at line 1",
  },
  {
    contract: { memoryRoot: "{{TRUSTED_NAMESPACE}}" },
    authored: "{{MEMORY_ROOT}}",
    detail: "{{TRUSTED_NAMESPACE}} at line 1",
  },
  {
    contract: { memoryRoot: "{{OPTION_LETTERS}}" },
    authored: "{{MEMORY_ROOT}}",
    detail: "{{OPTION_LETTERS}} at line 1",
  },
])("inserted reserved token remains residue: $authored $contract", ({
  contract,
  authored,
  detail,
}) => {
  expect(
    renderProjection(
      preparationFixture({
        contract,
        document: { body: authored, description: null, hook: null },
        absorbedKnowledge: [],
      }),
    ),
  ).toEqual({
    status: "invalid",
    findings: [{ code: "unresolved-token", subject: "plugin:test-pro/reviewer", detail }],
  });
});
test("one scan resolves all authored tokens in either order without changing other braces or dollars", () => {
  expect(
    successful(
      renderProjection(
        preparationFixture({
          contract: { invocation: "echo $$ $& $` $' {{ customer.name }}" },
          document: {
            body: "{{HARNESS_DIR}}/rules/x {{HARNESS_DIR}} {{AIDLC_INVOKE}} {{INVOKE}} {{MEMORY_ROOT}}\n{{MEMORY_ROOT}} {{INVOKE}} {{AIDLC_INVOKE}} {{HARNESS_DIR}} {{HARNESS_DIR}}/rules/x",
            description: null,
            hook: null,
          },
          absorbedKnowledge: [],
        }),
      ),
    ).body,
  ).toBe(
    ".claude/guardrails/x .claude echo $$ $& $` $' {{ customer.name }} echo $$ $& $` $' {{ customer.name }} aidlc/spaces/default/memory\naidlc/spaces/default/memory echo $$ $& $` $' {{ customer.name }} echo $$ $& $` $' {{ customer.name }} .claude .claude/guardrails/x",
  );
});

test.each([
  {
    document: { body: "plain", description: "{{INVOKE}}", hook: null },
    absorbedKnowledge: [],
    subject: "plugin:test-pro/reviewer/description",
  },
  {
    document: {
      body: "plain",
      description: null,
      hook: { event: "session-start", command: "{{AIDLC_INVOKE}}" },
    },
    absorbedKnowledge: [],
    subject: "plugin:test-pro/reviewer/hook",
  },
  {
    document: { body: "plain", description: null, hook: null },
    absorbedKnowledge: ["{{INVOKE}}"],
    subject: "plugin:test-pro/reviewer",
  },
] as const)("replacement residue is refused in every projected field: $subject", ({
  document,
  absorbedKnowledge,
  subject,
}) => {
  expect(
    renderProjection(
      preparationFixture({
        document,
        absorbedKnowledge,
        contract: { invocation: "echo {{MEMORY_ROOT}}" },
      }),
    ),
  ).toMatchObject({ status: "invalid", findings: [{ code: "unresolved-token", subject }] });
});
