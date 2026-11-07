import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import { issueGitCredential, type MintAuthorToken } from "./issue-git-credential.ts";

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

const authorToken = secret("ghs_author");

const fakeMint = () => vi.fn<MintAuthorToken>().mockResolvedValue(succeed(authorToken));

describe("issueGitCredential", () => {
  it("mints the author token for the configured repository over https", async () => {
    const mintAuthorToken = fakeMint();

    const issued = await issueGitCredential({
      query: { protocol: "https", host: "github.com", path: "HailsTails/minutesarah-shop.git" },
      repository,
      mintAuthorToken,
    });

    expect(issued).toEqual(succeed(authorToken));
    expect(mintAuthorToken).toHaveBeenCalledOnce();
  });

  it("refuses another repository without minting", async () => {
    const mintAuthorToken = fakeMint();

    const issued = await issueGitCredential({
      query: { protocol: "https", host: "github.com", path: "HailsTails/rin.git" },
      repository,
      mintAuthorToken,
    });

    expect(issued).toEqual(
      fail({
        kind: "credential-destination-refused",
        destination: "https://github.com/HailsTails/rin.git",
      }),
    );
    expect(mintAuthorToken).not.toHaveBeenCalled();
  });

  it("refuses a request that names no repository path", async () => {
    const issued = await issueGitCredential({
      query: { protocol: "https", host: "github.com", path: undefined },
      repository,
      mintAuthorToken: fakeMint(),
    });

    expect(issued).toEqual(
      fail({ kind: "credential-destination-refused", destination: "https://github.com/" }),
    );
  });

  it("refuses plain http", async () => {
    const issued = await issueGitCredential({
      query: { protocol: "http", host: "github.com", path: "HailsTails/minutesarah-shop.git" },
      repository,
      mintAuthorToken: fakeMint(),
    });

    expect(issued).toEqual(
      fail({
        kind: "credential-destination-refused",
        destination: "http://github.com/HailsTails/minutesarah-shop.git",
      }),
    );
  });
});
