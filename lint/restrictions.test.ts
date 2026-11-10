import { describe, expect, test } from "bun:test";
import {
  hostBundleRefusalsFor,
  methodAssertion,
  methodSyntaxFor,
  purityOf,
} from "./restrictions.ts";

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

describe("hostBundleImportRestrictions", () => {
  test("a host's own folder named like a context is not a context reach", () => {
    expect(hostBundleRefusalsFor("./projection/delegate-shell-deny.ts")).toEqual([]);
  });

  test("climbing out of the host into a context's internals is refused", () => {
    expect(hostBundleRefusalsFor("../../projection/application/use-cases/render.ts")).toHaveLength(1);
    expect(hostBundleRefusalsFor("../../../projection/adapters/render.ts")).toHaveLength(1);
  });

  test("a context's published surface stays reachable", () => {
    expect(hostBundleRefusalsFor("../../../projection/domain/projection.ts")).toEqual([]);
    expect(hostBundleRefusalsFor("../../../projection/application/ports/agents.ts")).toEqual([]);
  });
});
