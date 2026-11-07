import { assert, describe, expect, it } from "vitest";
import { succeed } from "../../domain/result.ts";
import { parseCredentialQuery } from "./git-credential-query.ts";

describe("parseCredentialQuery", () => {
  it("reads the attributes git sends a credential helper", () => {
    expect(
      parseCredentialQuery(
        "protocol=https\nhost=github.com\npath=HailsTails/minutesarah-shop.git\n\n",
      ),
    ).toEqual(
      succeed({ protocol: "https", host: "github.com", path: "HailsTails/minutesarah-shop.git" }),
    );
  });

  it("keeps an equals sign inside a value", () => {
    expect(parseCredentialQuery("protocol=https\r\nhost=github.com\r\npath=a/b=c\r\n")).toEqual(
      succeed({ protocol: "https", host: "github.com", path: "a/b=c" }),
    );
  });

  it("leaves the path absent when git sends none", () => {
    expect(parseCredentialQuery("protocol=https\nhost=github.com\n")).toEqual(
      succeed({ protocol: "https", host: "github.com", path: undefined }),
    );
  });

  it("refuses a request without a host", () => {
    const query = parseCredentialQuery("protocol=https\n");

    assert(query.kind === "failure" && query.reason.kind === "credential-query-invalid");
    expect(query.reason.issues).toContain("host");
  });
});
