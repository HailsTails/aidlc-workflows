import { expect, test } from "bun:test";
import { DEFAULT_WORKSPACE } from "./workspace.ts";

test("the default space has one canonical memory, seed and pointer vocabulary", () => {
  expect(DEFAULT_WORKSPACE).toEqual({ name: "default", memory: "aidlc/spaces/default/memory",
    seed: "tools/data/memory-seed", activeSpace: "aidlc/active-space" });
});
