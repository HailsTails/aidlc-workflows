import { expect, test } from "bun:test";
import { reviewerRequest } from "../__tests__/fixtures.ts";
import { first, successful } from "../__tests__/support.ts";
import { prepareAndProject } from "../src/application/prepare.ts";
import { projectPortable } from "../src/application/portable.ts";
import { claudeTarget } from "../src/adapters/claude.ts";
import { cursorTarget } from "../src/adapters/cursor.ts";
import { integrate } from "../src/domain/integration.ts";
import { planInstallation } from "../src/domain/installation.ts";
import { createMemoryWriter } from "../src/infrastructure/memory-writer.ts";

test.each([
  {
    harness: "claude",
    directory: ".claude",
    target: claudeTarget({ harness: "claude", directory: ".claude" }),
  },
  {
    harness: "cursor",
    directory: ".cursor",
    target: cursorTarget({ harness: "cursor", directory: ".cursor" }),
  },
])("composition: $harness live boundaries install and disable a reviewer contribution", ({
  harness,
  directory,
  target,
}) => {
  const authored = reviewerRequest();
  const request = {
    ...authored,
    contract: {
      ...authored.contract,
      harness,
      harnessDir: directory,
      tiers: {
        templated: { model: null, effort: null },
        balanced: { model: null, effort: null },
        judgment: { model: null, effort: null },
      },
    },
  };
  const document = first({ entries: successful(prepareAndProject({ input: request })) });
  const offline = first({
    entries: successful(projectPortable({ json: JSON.stringify(request) })),
  });
  expect(document).toMatchObject({ harness, harnessDir: directory, id: "reviewer", kind: "agent" });
  expect(offline).toMatchObject({ harness, harnessDir: directory, id: "reviewer", kind: "agent" });
  const native = successful(integrate({ document: offline, target }));
  const writer = createMemoryWriter();
  const installation = successful(
    planInstallation({
      harness,
      selectedPlugins: ["test-pro"],
      bundles: [native],
      snapshot: writer.snapshot(),
      policy: "reconcile",
    }),
  );
  expect(writer.apply(installation)).toEqual({ status: "applied", revision: 1 });
  expect(writer.snapshot().resources).toMatchObject([
    { kind: "file", ownership: { unit: "plugin:test-pro/reviewer" } },
    { kind: "registration", ownership: { unit: "plugin:test-pro/reviewer" } },
  ]);
  expect(writer.apply(installation)).toEqual({ status: "blocked", reason: "stale-snapshot" });
  const disable = successful(
    planInstallation({
      harness,
      selectedPlugins: [],
      bundles: [],
      snapshot: writer.snapshot(),
      policy: "preserve",
    }),
  );
  expect(writer.apply(disable)).toEqual({ status: "applied", revision: 2 });
  expect(writer.snapshot()).toEqual({ revision: 2, resources: [] });
});

test("composition: core and plugin normalized inputs share projection semantics", () => {
  const core = first({
    entries: successful(
      prepareAndProject({ input: reviewerRequest({ kind: "core", id: "framework" }) }),
    ),
  });
  const plugin = first({ entries: successful(prepareAndProject({ input: reviewerRequest() })) });
  expect(core).toMatchObject({
    key: "core:framework/reviewer",
    body: "Review using .claude/guardrails/ and aidlc/spaces/default/memory. Run aidlc. Literal template: {{ customer.name }}.\n\n---\n\nCheck evidence against .claude/guardrails/review.md.",
    nativeTier: { model: "inherit", effort: null },
  });
  expect(plugin).toMatchObject({
    key: "plugin:test-pro/reviewer",
    body: "Review using .claude/guardrails/ and aidlc/spaces/default/memory. Run aidlc. Literal template: {{ customer.name }}.\n\n---\n\nCheck evidence against .claude/guardrails/review.md.",
    nativeTier: { model: "inherit", effort: null },
  });
});

test.each([
  "echo {{HARNESS_DIR}}",
  "echo {{MEMORY_ROOT}}",
])("composition: replacement residue reaches the application boundary: %s", (invocation) => {
  const request = reviewerRequest();
  expect(
    prepareAndProject({ input: { ...request, contract: { ...request.contract, invocation } } }),
  ).toMatchObject({
    status: "invalid",
    findings: [{ code: "unresolved-token", subject: "plugin:test-pro/reviewer" }],
  });
});
