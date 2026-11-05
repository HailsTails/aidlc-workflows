import { expect, test } from "bun:test";
import {
  installedFixture as installed,
  bundleFixture as native,
  installationFixture,
} from "../../__tests__/installation-fixtures.ts";
import { decideInstallation } from "./installation-decision.ts";
const plan = (
  changes: Partial<import("./installation-decision.ts").InstallationDecisionInput> = {},
) => decideInstallation(installationFixture(changes));

test("reviewer body and hook enter a single selected installation plan", () => {
  expect(plan()).toMatchObject({
    conflicts: [],
    changes: [
      {
        action: "put",
        resource: { kind: "file", ownership: { unit: "plugin:test-pro/reviewer" } },
      },
      {
        action: "put",
        resource: { kind: "registration", ownership: { unit: "plugin:test-pro/reviewer" } },
      },
    ],
  });
});
test("deselection removes both unchanged owned resources under preserve policy", () => {
  expect(
    plan({
      selectedPlugins: [],
      bundles: [],
      policy: "preserve",
      snapshot: { revision: 1, resources: installed() },
    }),
  ).toMatchObject({
    conflicts: [],
    changes: [
      { action: "remove", key: "file:.claude/agents/reviewer.md" },
      { action: "remove", key: "registration:.claude/hooks/reviewer.json" },
    ],
  });
});
test("modified owned body blocks hook removal and leaves no partial plan", () => {
  expect(
    plan({
      selectedPlugins: [],
      bundles: [],
      snapshot: { revision: 1, resources: installed({ fileBody: "User edit" }) },
    }),
  ).toMatchObject({ changes: [], conflicts: [{ code: "modified-owned-content" }] });
});
test("modified owned registration blocks reviewer replacement", () => {
  expect(
    plan({
      bundles: [
        native({
          resources: [
            { kind: "file", path: ".claude/agents/reviewer.md", body: "Changed reviewer" },
            { kind: "registration", path: ".claude/hooks/reviewer.json", body: "Hook" },
          ],
        }),
      ],
      snapshot: { revision: 1, resources: installed({ registrationBody: "User hook" }) },
    }),
  ).toMatchObject({ changes: [], conflicts: [{ code: "modified-owned-content" }] });
});
test("reconcile replaces an unchanged owned reviewer and preserve refuses replacement", () => {
  expect(
    plan({
      bundles: [
        native({
          resources: [
            { kind: "file", path: ".claude/agents/reviewer.md", body: "Changed reviewer" },
            { kind: "registration", path: ".claude/hooks/reviewer.json", body: "Hook" },
          ],
        }),
      ],
      snapshot: { revision: 1, resources: installed() },
    }),
  ).toMatchObject({
    conflicts: [],
    changes: [
      {
        action: "put",
        resource: { kind: "file", body: expect.stringContaining("Changed reviewer") },
      },
    ],
  });
  expect(
    plan({
      policy: "preserve",
      bundles: [
        native({
          resources: [
            { kind: "file", path: ".claude/agents/reviewer.md", body: "Changed reviewer" },
            { kind: "registration", path: ".claude/hooks/reviewer.json", body: "Hook" },
          ],
        }),
      ],
      snapshot: { revision: 1, resources: installed() },
    }),
  ).toMatchObject({ changes: [], conflicts: [{ code: "preserved-owned-content" }] });
});
test("unowned matching bytes never imply adoption", () => {
  expect(
    plan({
      snapshot: {
        revision: 1,
        resources: installed({ fileOwnership: null, registrationOwnership: null }),
      },
    }),
  ).toMatchObject({
    changes: [],
    conflicts: [{ code: "foreign-content" }, { code: "foreign-content" }],
  });
});
test("destination collisions block all changes and another harness's resources survive", () => {
  expect(plan({ bundles: [native(), native()] })).toMatchObject({
    changes: [],
    conflicts: [{ code: "destination-collision" }, { code: "destination-collision" }],
  });
  expect(
    plan({
      selectedPlugins: [],
      bundles: [],
      snapshot: {
        revision: 1,
        resources: [
          {
            kind: "file",
            path: ".aidlc/other.md",
            body: "other",
            ownership: {
              harness: "copilot",
              unit: "core:framework/other",
              source: { kind: "core", id: "framework" },
              body: "other",
            },
          },
        ],
      },
    }),
  ).toMatchObject({ changes: [], conflicts: [] });
});
test("the same desired content produces no operations on repeated planning", () => {
  expect(plan({ snapshot: { revision: 1, resources: installed() } })).toMatchObject({
    changes: [],
    conflicts: [],
  });
});
