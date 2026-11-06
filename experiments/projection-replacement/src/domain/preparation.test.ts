import { expect, test, mock } from "bun:test";
import {
  createPreparation,
  isPreparedProjection as isCanonicalPreparedProjection,
  type PreparationRules,
} from "./preparation.ts";
import { first, requestWith, successful } from "../../__tests__/support.ts";

test("typed preparation reports the path validator refusal", () => {
  const pathStatus = mock<PreparationRules["pathStatus"]>().mockReturnValue("safe");
  const { prepare } = createPreparation({
    pathStatus,
    identifierStatus: mock<PreparationRules["identifierStatus"]>().mockReturnValue("valid"),
    selectionFor: mock<PreparationRules["selectionFor"]>().mockReturnValue("selected"),
  });
  pathStatus.mockReturnValueOnce("unsafe");
  expect(prepare(requestWith({ contract: { harnessDir: "../outside" } }))).toEqual({
    status: "invalid",
    findings: [
      {
        code: "invalid-path",
        subject: "contract.harnessDir",
        detail: "expected a relative POSIX path without traversal",
      },
    ],
  });
});
test("selected plugin reviewers cannot silently use core knowledge", () => {
  const pathStatus = mock<PreparationRules["pathStatus"]>().mockReturnValue("safe");
  const { prepare } = createPreparation({
    pathStatus,
    identifierStatus: mock<PreparationRules["identifierStatus"]>().mockReturnValue("valid"),
    selectionFor: mock<PreparationRules["selectionFor"]>().mockReturnValue("selected"),
  });
  expect(
    prepare(
      requestWith({
        request: {
          knowledge: [
            { source: { kind: "core", id: "framework" }, id: "reviewing", body: "Unrelated" },
          ],
        },
      }),
    ),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "missing-knowledge",
        subject: "plugin:test-pro/reviewer",
        detail: "plugin:test-pro/reviewing is required",
      },
    ],
  });
});
test("unselected plugins need no unavailable reviewer context", () => {
  const pathStatus = mock<PreparationRules["pathStatus"]>().mockReturnValue("safe");
  const { prepare } = createPreparation({
    pathStatus,
    identifierStatus: mock<PreparationRules["identifierStatus"]>().mockReturnValue("valid"),
    selectionFor: mock<PreparationRules["selectionFor"]>().mockReturnValue("deselected"),
  });
  expect(prepare(requestWith({ request: { selectedPlugins: [], knowledge: [] } }))).toEqual({
    status: "ok",
    value: [],
  });
});
test("tier caps resolve to the supplied native mapping", () => {
  const pathStatus = mock<PreparationRules["pathStatus"]>().mockReturnValue("safe");
  const { prepare } = createPreparation({
    pathStatus,
    identifierStatus: mock<PreparationRules["identifierStatus"]>().mockReturnValue("valid"),
    selectionFor: mock<PreparationRules["selectionFor"]>().mockReturnValue("selected"),
  });
  expect(
    first({ entries: successful(prepare(requestWith({ contract: { tierCap: "balanced" } }))) })
      .nativeTier,
  ).toEqual({ model: "sonnet", effort: "medium" });
});
test("missing capabilities and tiers produce explicit findings", () => {
  const pathStatus = mock<PreparationRules["pathStatus"]>().mockReturnValue("safe");
  const { prepare } = createPreparation({
    pathStatus,
    identifierStatus: mock<PreparationRules["identifierStatus"]>().mockReturnValue("valid"),
    selectionFor: mock<PreparationRules["selectionFor"]>().mockReturnValue("selected"),
  });
  expect(
    prepare(requestWith({ document: { tier: null }, contract: { capabilities: [] } })),
  ).toMatchObject({
    status: "invalid",
    findings: [
      { code: "missing-tier" },
      { code: "capability-gap", detail: "harness claude lacks agents" },
      { code: "capability-gap", detail: "harness claude lacks knowledge" },
      { code: "capability-gap", detail: "harness claude lacks hooks" },
    ],
  });
});
test.each([
  null,
  "",
  "  \n",
])("blank description %s is rejected at typed preparation", (description) => {
  const pathStatus = mock<PreparationRules["pathStatus"]>().mockReturnValue("safe");
  const { prepare } = createPreparation({
    pathStatus,
    identifierStatus: mock<PreparationRules["identifierStatus"]>().mockReturnValue("valid"),
    selectionFor: mock<PreparationRules["selectionFor"]>().mockReturnValue("selected"),
  });
  expect(prepare(requestWith({ document: { description } }))).toMatchObject({
    status: "invalid",
    findings: [{ code: "missing-description" }],
  });
});

test("duplicate selected plugins are rejected by preparation", () => {
  const pathStatus = mock<PreparationRules["pathStatus"]>().mockReturnValue("safe");
  const { prepare } = createPreparation({
    pathStatus,
    identifierStatus: mock<PreparationRules["identifierStatus"]>().mockReturnValue("valid"),
    selectionFor: mock<PreparationRules["selectionFor"]>().mockReturnValue("selected"),
  });
  expect(prepare(requestWith({ request: { selectedPlugins: ["test-pro", "test-pro"] } }))).toEqual({
    status: "invalid",
    findings: [{ code: "duplicate", subject: "test-pro", detail: "identity must be unique" }],
  });
});

test("preparation owns frozen authentic input facts", () => {
  const { prepare, isPreparedProjection } = createPreparation({
    pathStatus: mock<PreparationRules["pathStatus"]>().mockReturnValue("safe"),
    identifierStatus: mock<PreparationRules["identifierStatus"]>().mockReturnValue("valid"),
    selectionFor: mock<PreparationRules["selectionFor"]>().mockReturnValue("selected"),
  });
  const prepared = first({ entries: successful(prepare(requestWith())) });
  expect(isPreparedProjection({ candidate: prepared })).toBe(true);
  expect(isCanonicalPreparedProjection({ candidate: prepared })).toBe(false);
  expect(isPreparedProjection({ candidate: { ...prepared } })).toBe(false);
  expect(Object.isFrozen(prepared.document.source)).toBe(true);
  expect(Object.isFrozen(prepared.nativeTier)).toBe(true);
});
