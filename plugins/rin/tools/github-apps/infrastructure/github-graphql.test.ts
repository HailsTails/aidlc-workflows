import { assert, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import type { GitHubHttp } from "./github-http.ts";
import { executeGraphql } from "./github-graphql.ts";

const credential = secret("ghs_token");

const viewerOperation = {
  operation: "read viewer",
  query: "query Viewer { viewer { login } }",
  variables: { first: 1 },
  dataSchema: z.object({ viewer: z.object({ login: z.string() }) }),
};

const fakeHttp = (reply: unknown) => ({
  requestJson: vi.fn<GitHubHttp["requestJson"]>().mockResolvedValue(succeed(reply)),
});

describe("executeGraphql", () => {
  it("posts the query and variables, returning the validated data", async () => {
    const http = fakeHttp({ data: { viewer: { login: "rin-author[bot]" } } });

    const executed = await executeGraphql({ ...viewerOperation, http, credential });

    expect(executed).toEqual(succeed({ viewer: { login: "rin-author[bot]" } }));
    expect(http.requestJson).toHaveBeenCalledExactlyOnceWith({
      operation: "read viewer",
      method: "POST",
      path: "/graphql",
      credential,
      requestBody: { query: "query Viewer { viewer { login } }", variables: { first: 1 } },
    });
  });

  it("reports GraphQL errors as a rejection", async () => {
    const http = fakeHttp({
      data: null,
      errors: [{ message: "Head sha didn't match" }, { message: "Try again" }],
    });

    expect(await executeGraphql({ ...viewerOperation, http, credential })).toEqual(
      fail({
        kind: "github-rejected",
        operation: "read viewer",
        status: 200,
        detail: "Head sha didn't match; Try again",
      }),
    );
  });

  it("reports data that does not match the expected shape", async () => {
    const http = fakeHttp({ data: { viewer: null } });

    const executed = await executeGraphql({ ...viewerOperation, http, credential });

    assert(executed.kind === "failure" && executed.reason.kind === "github-response-invalid");
    expect(executed.reason.operation).toBe("read viewer");
    expect(executed.reason.issues).toContain("viewer");
  });

  it("passes a transport failure through", async () => {
    const http = {
      requestJson: vi
        .fn<GitHubHttp["requestJson"]>()
        .mockResolvedValue(fail({ kind: "github-unreachable", operation: "read viewer" })),
    };

    expect(await executeGraphql({ ...viewerOperation, http, credential })).toEqual(
      fail({ kind: "github-unreachable", operation: "read viewer" }),
    );
  });
});
