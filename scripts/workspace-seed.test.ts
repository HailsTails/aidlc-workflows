import { expect, test } from "bun:test";
import { freshWorkspaceSeed } from "./workspace-seed.ts";

test("fresh workspace seed declares the relative cursor and exact default plus LF", () => {
  expect(freshWorkspaceSeed()).toEqual({ file: "aidlc/active-space", content: "default\n" });
});
