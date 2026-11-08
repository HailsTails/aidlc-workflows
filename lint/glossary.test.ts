import { describe, expect, test } from "bun:test";
import { GLOSSARY } from "./glossary.ts";

describe("glossary", () => {
  test("reads each owned concept with its context", () => {
    expect(GLOSSARY).toContainEqual(
      expect.objectContaining({ name: "FileContent", context: "kernel", kind: "concept" }),
    );
  });
});
