import { expect, test } from "bun:test";
import { planOwnedProducts, issueCoreProjectionOwnership } from "./projection-ownership.ts";
import { ownedPlanRequest, ownedProduct, ownershipRecord, changedOwnedSeed, modeChangedSeed, updatedOwnedProduct, ownedRetirement, emptyOwnership } from "../../../../tests/unit/projection/support/__tests__/projection-ownership-fixtures.ts";
import { distributionSeed } from "../../../../tests/unit/projection/support/__tests__/distribution-fixtures.ts";
import { successful } from "../../../../tests/unit/projection/support/__tests__/support.ts";
import { issuedCoreDistribution, ownershipDigest } from "../../../../tests/unit/projection/support/__tests__/projection-ownership-fixtures.ts";
test("reapplies an independently recorded product as a byte-proven replacement", () => {
  expect(successful(planOwnedProducts(ownedPlanRequest))).toEqual({ edits: [{ kind: "replace", previous: ownedProduct, product: ownedProduct }], ownership: ownershipRecord });
});
test("changed current bytes refuse overwrite", () => {
  expect(planOwnedProducts({ ...ownedPlanRequest, seed: changedOwnedSeed })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/skills/owned/SKILL.md", detail: "persisted ownership differs from current bytes or mode; preserve the changed file and resolve ownership explicitly" }] });
});
test("matching bytes cannot bypass a changed permission mode", () => {
  expect(planOwnedProducts({ ...ownedPlanRequest, seed: modeChangedSeed })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/skills/owned/SKILL.md", detail: "persisted ownership differs from current bytes or mode; preserve the changed file and resolve ownership explicitly" }] });
});
test("an authored update records desired digests after proving previous bytes", () => {
  expect(successful(planOwnedProducts({ ...ownedPlanRequest, products: [updatedOwnedProduct] })).ownership.products).toEqual([{ ...updatedOwnedProduct, files: [{ path: ".claude/skills/owned/SKILL.md", mode: 0o644, sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] }]);
});
test("explicit retirement removes only the recorded product", () => {
  expect(successful(planOwnedProducts({ ...ownedPlanRequest, products: [], retirements: [ownedRetirement] }))).toEqual({ edits: [{ kind: "remove", previous: ownedProduct }], ownership: emptyOwnership });
});
test("unselected records remain owned without emitting edits", () => {
  expect(successful(planOwnedProducts({ ...ownedPlanRequest, products: [] }))).toEqual({ edits: [], ownership: ownershipRecord });
});
test("an unrecorded product stays an addition even if the seed contains equal bytes", () => {
  expect(successful(planOwnedProducts({ ...ownedPlanRequest, ownership: emptyOwnership })).edits).toEqual([{ kind: "add", product: ownedProduct }]);
});
test("absent recorded files can be retired without claiming unrelated bytes", () => {
  expect(successful(planOwnedProducts({ ...ownedPlanRequest, seed: distributionSeed, products: [], retirements: [ownedRetirement] })).edits).toEqual([{ kind: "remove", previous: { ...ownedProduct, files: [{ path: ".claude/skills/owned/SKILL.md", mode: 0o644, bytes: new Uint8Array() }] } }]);
});
test("unknown retirement cannot invent ownership", () => {
  expect(planOwnedProducts({ ...ownedPlanRequest, ownership: emptyOwnership, products: [], retirements: [ownedRetirement] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core:framework/owned", detail: "retirement requires an existing persisted product record" }] });
});
test("an absent retained footprint still blocks a second owner", () => {
  expect(planOwnedProducts({ ...ownedPlanRequest, seed: distributionSeed, products: [{ ...ownedProduct, key: "another" }] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/owned/SKILL.md", detail: "persisted and desired products must retain one owner per path, including absent files" }] });
});
test("initial issuance records only the actual final core projection", () => {
  expect(issueCoreProjectionOwnership({ distribution: issuedCoreDistribution, products: [ownedProduct], digest: ownershipDigest })).toEqual({ status: "ok", value: ownershipRecord });
});
test("equal retained native bytes cannot masquerade as projected output", () => {
  expect(issueCoreProjectionOwnership({ distribution: { ...issuedCoreDistribution, replaced: [] }, products: [ownedProduct], digest: ownershipDigest })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/skills/owned/SKILL.md", detail: "initial ownership must describe an actually projected final file with identical bytes and mode; retained native files are not projected products" }] });
});
test("ownership cannot be issued for bytes different from the final artifact", () => {
  expect(issueCoreProjectionOwnership({ distribution: issuedCoreDistribution, products: [updatedOwnedProduct], digest: ownershipDigest })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/skills/owned/SKILL.md", detail: "initial ownership must describe an actually projected final file with identical bytes and mode; retained native files are not projected products" }] });
});
test("matching bytes cannot hide a final file mode difference", () => {
  expect(issueCoreProjectionOwnership({ distribution: issuedCoreDistribution, products: [{ ...ownedProduct, files: [{ ...ownedProduct.files[0], path: ".claude/skills/owned/SKILL.md", bytes: new Uint8Array([97, 98, 99]), mode: 0o755 }] }], digest: ownershipDigest })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/skills/owned/SKILL.md", detail: "initial ownership must describe an actually projected final file with identical bytes and mode; retained native files are not projected products" }] });
});
test("a compiler source alias cannot relabel initial core provenance", () => {
  expect(issueCoreProjectionOwnership({ distribution: issuedCoreDistribution, products: [{ ...ownedProduct, inputs: [{ ...ownedProduct.owner, source: { kind: "plugin", id: "rin" }, path: "core/tools/aidlc-runner-gen.ts" }] }], digest: ownershipDigest })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "core-projection-issuance", detail: "initial core issuance requires the assembled binding and exact core owner/compiler source basis" }] });
});
test("duplicate product declarations cannot obtain a valid initial record", () => {
  expect(issueCoreProjectionOwnership({ distribution: issuedCoreDistribution, products: [ownedProduct, ownedProduct], digest: ownershipDigest })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "core-projection-issuance", detail: "issue a nonempty core projection with unique product identities and file paths" }] });
});
