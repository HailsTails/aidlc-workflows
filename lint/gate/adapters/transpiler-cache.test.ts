import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { transpilerCacheFolder } from "./transpiler-cache.ts";

const ROOT = join(import.meta.dir, "../../..");
const folder = transpilerCacheFolder(ROOT);

afterAll(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe("transpilerCacheFolder", () => {
  test("it is a folder beside the main checkout that exists, outside the repository", () => {
    expect(existsSync(folder)).toBe(true);
    expect(folder.startsWith(ROOT)).toBe(false);
  });
});
