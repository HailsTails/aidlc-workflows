import { describe, expect, test } from "bun:test";
import { methodAssertion, methodSyntaxFor, purityOf } from "./restrictions.ts";

describe("purityOf", () => {
  test("domain and application are pure", () => {
    expect(purityOf("domain")).toBe("pure");
    expect(purityOf("application")).toBe("pure");
  });

  test("adapters and roots are effectful", () => {
    expect(purityOf("adapters")).toBe("effectful");
    expect(purityOf("root")).toBe("effectful");
  });
});

describe("methodSyntaxFor", () => {
  test("only the compiling use case and fixtures may assert a Method", () => {
    expect(methodSyntaxFor("workflow-definition", "application")).toEqual([]);
    expect(methodSyntaxFor("projection", "fixtures")).toEqual([]);
  });

  test("every other layer is refused the assertion", () => {
    expect(methodSyntaxFor("projection", "domain")).toBe(methodAssertion);
  });
});
