import { expect, test } from "bun:test";
import { createDistributionProductReconciler } from "./distribution-products.ts";
import { alreadyRemovedProductSeed, createProductRules, modifiedProductSeed, parentFileProduct, pluginDistributionProduct, pluginProductBasis, previousDistributionProduct, productRequest, protectedDistributionProduct, renamedDistributionProduct, upgradedDistributionProduct } from "../../__tests__/distribution-product-fixtures.ts";
import { successful } from "../../__tests__/support.ts";
test("removes only the explicitly selected and byte-proven footprint", () => {
  const reconciled = successful(createDistributionProductReconciler({ rules: createProductRules() }).reconcile(productRequest));
  expect(reconciled.removed).toEqual([".claude/skills/aidlc-session-cost/SKILL.md"]);
  expect(reconciled.files).toHaveLength(4);
  expect(reconciled.projected).toEqual([]);
  expect(reconciled.files[3]).toEqual({ path: ".claude/assets/opaque.bin", bytes: new Uint8Array([0, 255, 128]), mode: 0o755 });
});
test("adds a declared plugin product without relabeling retained seed bytes", () => {
  const reconciled = successful(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, edits: [{ kind: "add", product: pluginDistributionProduct }] }));
  expect(reconciled.files).toHaveLength(6);
  expect(reconciled.added).toEqual([".claude/skills/rin-gate-0-reconcile/SKILL.md"]);
  expect(reconciled.retained).toHaveLength(5);
  expect(reconciled.projected).toEqual([{ key: "rin-gate-0-reconcile", owner: pluginProductBasis, paths: [".claude/skills/rin-gate-0-reconcile/SKILL.md"] }]);
});
test("replacement explicitly retires the old footprint and adds the new one", () => {
  const reconciled = successful(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, edits: [{ kind: "replace", previous: previousDistributionProduct, product: renamedDistributionProduct }] }));
  expect(reconciled.removed).toEqual([".claude/skills/aidlc-session-cost/SKILL.md"]);
  expect(reconciled.added).toEqual([".claude/skills/aidlc-session-cost-v2/SKILL.md"]);
  expect(reconciled.files[4]).toEqual({ path: ".claude/skills/aidlc-session-cost-v2/SKILL.md", bytes: new Uint8Array([9, 8]), mode: 0o644 });
});
test("a shorter changed file cannot pass the previous-byte guard", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, seed: modifiedProductSeed })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/skills/aidlc-session-cost/SKILL.md", detail: "previous projected bytes do not match the seed; preserve the changed or unproven file" }] });
  expect(modifiedProductSeed.files[3]?.bytes).toEqual(new Uint8Array([1]));
});
test("matching bytes alone cannot let an addition claim an existing file", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, edits: [{ kind: "add", product: previousDistributionProduct }] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-session-cost/SKILL.md", detail: "an addition cannot claim an existing seed file, even when its bytes match" }] });
});
test("a replacement cannot silently transfer ownership", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, edits: [{ kind: "replace", previous: previousDistributionProduct, product: { ...renamedDistributionProduct, owner: pluginProductBasis } }] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "session-cost", detail: "replacement must preserve product identity and owner; use explicit remove and add for a transfer" }] });
});
test("producer metadata remains protected even with matching previous bytes", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, edits: [{ kind: "remove", previous: protectedDistributionProduct }] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/tools/data/aidlc-stamp.json", detail: "producer-owned metadata cannot be reconciled as a projected product" }] });
});
test("plugin products need their own declared source pin", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, sources: [], edits: [{ kind: "add", product: pluginDistributionProduct }] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "rin-gate-0-reconcile", detail: "declare each product owner's exact source basis before reconciliation" }] });
});
test("parent-file conflicts refuse before an archive can be built", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, edits: [{ kind: "add", product: parentFileProduct }] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude", detail: "a native file cannot also be another file's parent directory" }] });
});
test("an empty selection never infers removal of all prior products", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, edits: [] })).toEqual({ status: "invalid", findings: [{ code: "empty-integration", subject: "distribution-products", detail: "select explicit product additions, replacements or removals" }] });
});
test("direct product construction cannot bypass permission mode validation", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, edits: [{ kind: "add", product: { ...pluginDistributionProduct, files: [{ path: ".claude/skills/rin-gate-0-reconcile/SKILL.md", bytes: new Uint8Array([9, 8]), mode: 0o1000 }] } }] })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: ".claude/skills/rin-gate-0-reconcile/SKILL.md", detail: "owned product files require permission modes between 0 and 0777" }] });
});
test("omitting caller protections cannot waive native producer metadata ownership", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, protectedPaths: [], edits: [{ kind: "remove", previous: protectedDistributionProduct }] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/tools/data/aidlc-stamp.json", detail: "producer-owned metadata cannot be reconciled as a projected product" }] });
});
test("an explicitly declared source upgrade can replace the same owned product", () => {
  const reconciled = successful(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, sources: [...productRequest.sources, upgradedDistributionProduct.owner], edits: [{ kind: "replace", previous: previousDistributionProduct, product: upgradedDistributionProduct }] }));
  expect(reconciled.projected).toEqual([{ key: "session-cost", owner: { source: { kind: "core", id: "framework" }, pin: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }, paths: [".claude/skills/aidlc-session-cost-v2/SKILL.md"] }]);
  expect(reconciled.removed).toEqual([".claude/skills/aidlc-session-cost/SKILL.md"]);
});
test("two product identities cannot share one native destination", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, edits: [{ kind: "add", product: pluginDistributionProduct }, { kind: "add", product: { ...pluginDistributionProduct, key: "other-product" } }] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/rin-gate-0-reconcile/SKILL.md", detail: "desired product footprints must have one owner" }] });
});
test("matching ownership cannot remove a file still required by its native producer", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, requiredPaths: [".claude/skills/aidlc-session-cost/SKILL.md"] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/skills/aidlc-session-cost/SKILL.md", detail: "native producer still requires this file; reconcile its definitions before removing the projected product" }] });
});
test("unrelated retained requirements do not prohibit retirement of an obsolete product", () => {
  const reconciled = successful(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, requiredPaths: [".claude/tools/data/harness.json"] }));
  expect(reconciled.removed).toEqual([".claude/skills/aidlc-session-cost/SKILL.md"]);
});
test("already absent obsolete files make removal idempotent without reporting fictitious deletions", () => {
  const reconciled = successful(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, seed: alreadyRemovedProductSeed }));
  expect(reconciled.removed).toEqual([]);
  expect(reconciled.files).toHaveLength(4);
});
test("a stale runner product cannot be added after its producer retires it", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, edits: [{ kind: "add", product: { ...pluginDistributionProduct, requiredByProducer: [".claude/skills/rin-gate-0-reconcile/SKILL.md"] } }] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/skills/rin-gate-0-reconcile/SKILL.md", detail: "current native definitions do not require this projected product; regenerate products from the current prepared runtime" }] });
});
test("a currently required native runner can fill its missing output slot", () => {
  const reconciled = successful(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, requiredPaths: [".claude/skills/rin-gate-0-reconcile/SKILL.md"], edits: [{ kind: "add", product: { ...pluginDistributionProduct, requiredByProducer: [".claude/skills/rin-gate-0-reconcile/SKILL.md"] } }] }));
  expect(reconciled.added).toEqual([".claude/skills/rin-gate-0-reconcile/SKILL.md"]);
});
test("product reconciliation retains empty directories rather than inferring their removal", () => {
  const reconciled = successful(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, seed: { ...productRequest.seed, directories: [{ path: ".claude/empty", mode: 0o755 }] } }));
  expect(reconciled.directories).toEqual([{ path: ".claude/empty", mode: 0o755 }]);
});
test("a file addition cannot overwrite a retained empty directory", () => {
  expect(createDistributionProductReconciler({ rules: createProductRules() }).reconcile({ ...productRequest, seed: { ...productRequest.seed, directories: [{ path: ".claude", mode: 0o755 }] }, edits: [{ kind: "add", product: parentFileProduct }] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude", detail: "a native file cannot replace a retained distribution directory" }] });
});
