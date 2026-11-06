import { expect, test } from "bun:test";
import { applyMemoryChanges, copyInstalledResource } from "./memory-installation.ts";
import { memoryPlanFixture } from "../../__tests__/installation-fixtures.ts";
test("body and registration changes apply together", () => {
  expect(
    applyMemoryChanges({ plan: memoryPlanFixture(), snapshot: { revision: 0, resources: [] } }),
  ).toEqual({
    status: "applied",
    snapshot: {
      revision: 1,
      resources: [
        { kind: "file", path: "reviewer.md", body: "Reviewer", ownership: null },
        { kind: "registration", path: "hook.json", body: "Hook", ownership: null },
      ],
    },
  });
});
test("conflicts block the complete change set", () => {
  expect(
    applyMemoryChanges({
      plan: memoryPlanFixture({
        conflicts: [{ code: "modified-owned-content", subject: "reviewer.md", detail: "Modified" }],
      }),
      snapshot: { revision: 0, resources: [] },
    }),
  ).toEqual({ status: "blocked", reason: "installation-conflicts" });
});
test("stale revisions block replay", () => {
  expect(
    applyMemoryChanges({ plan: memoryPlanFixture(), snapshot: { revision: 1, resources: [] } }),
  ).toEqual({ status: "blocked", reason: "stale-snapshot" });
});
test("a different snapshot at the same revision blocks replacement", () => {
  expect(
    applyMemoryChanges({
      plan: memoryPlanFixture(),
      snapshot: {
        revision: 0,
        resources: [{ kind: "file", path: "personal.md", body: "Personal", ownership: null }],
      },
    }),
  ).toEqual({ status: "blocked", reason: "snapshot-mismatch" });
});
test("removal preserves resources outside the change set", () => {
  expect(
    applyMemoryChanges({
      plan: memoryPlanFixture({
        expectedResources:
          '[{"kind":"file","path":"old.md","body":"Old","ownership":null},{"kind":"file","path":"personal.md","body":"Personal","ownership":null}]',
        changes: [{ action: "remove", key: "file:old.md" }],
      }),
      snapshot: {
        revision: 0,
        resources: [
          { kind: "file", path: "old.md", body: "Old", ownership: null },
          { kind: "file", path: "personal.md", body: "Personal", ownership: null },
        ],
      },
    }),
  ).toEqual({
    status: "applied",
    snapshot: {
      revision: 1,
      resources: [{ kind: "file", path: "personal.md", body: "Personal", ownership: null }],
    },
  });
});

test("copied ownership cannot be changed through the caller's resource", () => {
  const resource = {
    kind: "file",
    path: "reviewer.md",
    body: "Reviewer",
    ownership: {
      harness: "claude",
      unit: "plugin:test-pro/reviewer",
      source: { kind: "plugin", id: "test-pro" },
      body: "Reviewer",
    },
  } satisfies import("../domain/installation.ts").InstalledResource;
  const copied = copyInstalledResource(resource);
  expect(copied).toEqual(resource);
  expect(copied.ownership).not.toBe(resource.ownership);
  expect(Object.isFrozen(copied.ownership?.source)).toBe(true);
});
