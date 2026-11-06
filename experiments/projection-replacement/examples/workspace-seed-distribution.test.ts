import { expect, mock, test } from "bun:test";
import { createWorkspaceSeedDistributionSource } from "./workspace-seed-distribution.ts";
import { createSourceWorkspaceSeedPreparer, createSourceWorkspaceSeedServices } from "../src/adapters/source-workspace-seed.ts";
import { createPreparedInputDistributionSource } from "../src/adapters/prepared-input-source.ts";
import { createWorkspaceSeedFixture, workspaceSeedBasis } from "../__tests__/workspace-seed-fixtures.ts";
import { distributionSeed } from "../__tests__/distribution-fixtures.ts";

test("workspace seed composition reuses generic byte admission without installer authority", () => {
  const source = { load: mock() }, preparer = { prepare: mock() }, prepare = mock().mockReturnValue(preparer), create = mock().mockReturnValue(source);
  expect(createWorkspaceSeedDistributionSource({ source, mode: 0o640, create, prepare })).toBe(source);
  expect(prepare.mock.calls).toEqual([[]]);
  expect(create.mock.calls).toEqual([[{ source, mode: 0o640, preparer }]]);
});

test("composition: source API admission, encoding and generic addition retain the seed witness", async () => {
  const services = { ...createSourceWorkspaceSeedServices(), operations: createWorkspaceSeedFixture().operations };
  const inventory = { ...distributionSeed, basis: workspaceSeedBasis }, source = { load: mock().mockResolvedValue({ status: "ok", value: inventory }) };
  const prepared = createPreparedInputDistributionSource({ source, mode: 0o640, preparer: createSourceWorkspaceSeedPreparer({ services }) });
  expect(await prepared.load({ location: { sourceRoot: "authored-source", root: "native-input", basis: workspaceSeedBasis }, binding: { harness: "claude", directory: ".claude" } })).toEqual({ status: "ok", value: { ...inventory, files: [...inventory.files, { path: "aidlc/active-space", bytes: new Uint8Array([100, 101, 102, 97, 117, 108, 116, 10]), mode: 0o640 }], inputPreparations: [{ kind: "workspace-seed", paths: ["aidlc/active-space"], inputs: [{ path: "scripts/workspace-seed.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] }] } });
});

test("composition: an already present matching seed retains its supplied mode", async () => {
  const services = { ...createSourceWorkspaceSeedServices(), operations: createWorkspaceSeedFixture().operations };
  const inventory = { ...distributionSeed, basis: workspaceSeedBasis, files: [...distributionSeed.files, { path: "aidlc/active-space", bytes: new Uint8Array([100, 101, 102, 97, 117, 108, 116, 10]), mode: 0o666 }] }, source = { load: mock().mockResolvedValue({ status: "ok", value: inventory }) };
  const prepared = createPreparedInputDistributionSource({ source, mode: 0o640, preparer: createSourceWorkspaceSeedPreparer({ services }) });
  expect(await prepared.load({ location: { sourceRoot: "authored-source", root: "native-input", basis: workspaceSeedBasis }, binding: { harness: "claude", directory: ".claude" } })).toEqual({ status: "ok", value: { ...inventory, inputPreparations: [{ kind: "workspace-seed", paths: ["aidlc/active-space"], inputs: [{ path: "scripts/workspace-seed.ts", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] }] } });
});

test("composition: an edited supplied seed refuses generic admission without changing its bytes", async () => {
  const services = { ...createSourceWorkspaceSeedServices(), operations: createWorkspaceSeedFixture().operations };
  const edited = { path: "aidlc/active-space", bytes: new Uint8Array([116, 101, 97, 109, 45, 98, 10]), mode: 0o666 };
  const inventory = { ...distributionSeed, basis: workspaceSeedBasis, files: [...distributionSeed.files, edited] }, source = { load: mock().mockResolvedValue({ status: "ok", value: inventory }) };
  const prepared = createPreparedInputDistributionSource({ source, mode: 0o640, preparer: createSourceWorkspaceSeedPreparer({ services }) });
  expect(await prepared.load({ location: { sourceRoot: "authored-source", root: "native-input", basis: workspaceSeedBasis }, binding: { harness: "claude", directory: ".claude" } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "aidlc/active-space", detail: "existing prepared file differs from the candidate; preserve it or prepare a fresh staging tree" }] });
  expect(edited).toEqual({ path: "aidlc/active-space", bytes: new Uint8Array([116, 101, 97, 109, 45, 98, 10]), mode: 0o666 });
});
