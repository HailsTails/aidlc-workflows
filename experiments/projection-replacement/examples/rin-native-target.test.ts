import { expect, test, mock } from "bun:test";
import { rinNativeTarget } from "./rin-native-target.ts";
import type { HarnessTarget } from "../src/domain/native-rendering.ts";
import { projectionFixture } from "../__tests__/projection-fixtures.ts";
import { first, successful } from "../__tests__/support.ts";
import { requestWith } from "../__tests__/support.ts";
import { prepareAndProject } from "../src/application/prepare.ts";
import { claudeTarget } from "../src/adapters/claude.ts";
import { integrate } from "../src/domain/integration.ts";
import { planInstallation } from "../src/domain/installation.ts";
import { createMemoryWriter } from "../src/infrastructure/memory-writer.ts";

test("Rin assets use a consumer-owned native destination", () => {
  const render = mock<HarnessTarget["render"]>();
  const target = rinNativeTarget({ base: { harness: "claude", harnessDir: ".claude", render } });
  expect(
    target.render(
      projectionFixture({
        id: "discipline-selection",
        source: { kind: "plugin", id: "rin" },
        kind: "asset",
        body: '{"version":1}',
        hook: null,
        nativeTier: null,
      }),
    ),
  ).toEqual({
    status: "ok",
    value: [
      {
        kind: "file",
        path: ".claude/aidlc/examples/discipline-selection.json",
        body: '{"version":1}',
      },
    ],
  });
  expect(render).not.toHaveBeenCalled();
});

test.each([
  { source: { kind: "core", id: "framework" }, kind: "asset" },
  { source: { kind: "plugin", id: "other" }, kind: "asset" },
  { source: { kind: "plugin", id: "rin" }, kind: "agent" },
] satisfies readonly {
  readonly source: import("../src/domain/model.ts").DocumentSource;
  readonly kind: import("../src/domain/model.ts").NeutralDocument["kind"];
}[])("consumer adapter delegates $source.kind/$source.id $kind unchanged", ({ source, kind }) => {
  const render = mock<HarnessTarget["render"]>().mockReturnValue({ status: "ok", value: [] });
  const document = projectionFixture({ source, kind });
  const target = rinNativeTarget({ base: { harness: "claude", harnessDir: ".claude", render } });
  target.render(document);
  expect(render).toHaveBeenCalledTimes(1);
  expect(render).toHaveBeenCalledWith(document);
});

test("composition: a consumer-native asset keeps Rin ownership through install and deselection", () => {
  const request = requestWith({
    document: {
      id: "discipline-selection",
      source: { kind: "plugin", id: "rin" },
      kind: "asset",
      body: '{"version":1}',
      tier: null,
      description: null,
      knowledge: [],
      hook: null,
    },
    request: { selectedPlugins: ["rin"], knowledge: [], reviewers: [] },
  });
  const document = first({ entries: successful(prepareAndProject({ input: request })) });
  const target = rinNativeTarget({
    base: claudeTarget({ harness: "claude", directory: ".claude" }),
  });
  const bundle = successful(integrate({ document, target }));
  const writer = createMemoryWriter();
  const installation = successful(
    planInstallation({
      harness: "claude",
      selectedPlugins: ["rin"],
      bundles: [bundle],
      snapshot: writer.snapshot(),
      policy: "reconcile",
    }),
  );
  expect(writer.apply(installation)).toEqual({ status: "applied", revision: 1 });
  expect(writer.snapshot().resources).toEqual([
    {
      kind: "file",
      path: ".claude/aidlc/examples/discipline-selection.json",
      body: '{"version":1}',
      ownership: {
        harness: "claude",
        unit: "plugin:rin/discipline-selection",
        source: { kind: "plugin", id: "rin" },
        body: '{"version":1}',
      },
    },
  ]);
  const removal = successful(
    planInstallation({
      harness: "claude",
      selectedPlugins: [],
      bundles: [],
      snapshot: writer.snapshot(),
      policy: "preserve",
    }),
  );
  expect(writer.apply(removal)).toEqual({ status: "applied", revision: 2 });
  expect(writer.snapshot()).toEqual({ revision: 2, resources: [] });
});
