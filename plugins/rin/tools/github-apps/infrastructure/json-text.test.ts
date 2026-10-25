import { describe, expect, it } from "vitest";
import { parseJsonText } from "./json-text.ts";

describe("parseJsonText", () => {
  it("parses JSON text", () => {
    expect(parseJsonText('{"appId":"42"}')).toEqual({ kind: "success", outcome: { appId: "42" } });
  });

  it("reports text that is not JSON", () => {
    expect(parseJsonText("<html>")).toEqual({ kind: "failure", reason: { kind: "json-invalid" } });
  });
});
