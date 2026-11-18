import { describe, expect, test } from "bun:test";
import { NODE_BUILTINS } from "./node-builtins.ts";

describe("node builtins", () => {
  test("lists the runtime's built-in modules by bare name", () => {
    expect(NODE_BUILTINS).toContain("fs");
    expect(NODE_BUILTINS).toContain("path");
  });
});
