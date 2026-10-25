import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import type { StoreLocator } from "./credential-store-port.ts";
import { createBodyFileReader } from "./read-body-file.ts";
import type { CanonicalPathResolver, TextFileReader } from "./text-file-port.ts";

const storeDirectory = "C:/Users/helen/.config/rin-github-apps";

const canonicalPaths = (paths: Readonly<Record<string, string>>) =>
  vi
    .fn<CanonicalPathResolver>()
    .mockImplementation((location) =>
      Promise.resolve(
        paths[location] === undefined
          ? fail({ kind: "file-unreadable", location })
          : succeed(paths[location]),
      ),
    );

const readerFor = ({
  paths,
  fileText,
}: {
  readonly paths: Readonly<Record<string, string>>;
  readonly fileText: string;
}) => {
  const readTextFile = vi.fn<TextFileReader>().mockResolvedValue(succeed(fileText));
  const readBodyFile = createBodyFileReader({
    readTextFile,
    resolveCanonicalPath: canonicalPaths({ [storeDirectory]: storeDirectory, ...paths }),
    locateCredentialStore: vi.fn<StoreLocator>().mockReturnValue(succeed(storeDirectory)),
  });
  return { readBodyFile, readTextFile };
};

describe("createBodyFileReader", () => {
  it("reads an ordinary body file", async () => {
    const { readBodyFile, readTextFile } = readerFor({
      paths: { "body.md": "H:/shop/body.md" },
      fileText: "## Summary\n\nAdds the basket.",
    });

    expect(await readBodyFile("body.md")).toEqual(succeed("## Summary\n\nAdds the basket."));
    expect(readTextFile).toHaveBeenCalledExactlyOnceWith("H:/shop/body.md");
  });

  it("refuses a file inside the credential store without reading it", async () => {
    const { readBodyFile, readTextFile } = readerFor({
      paths: { "../keys/credentials.json": `${storeDirectory}/credentials.json` },
      fileText: "{}",
    });

    expect(await readBodyFile("../keys/credentials.json")).toEqual(
      fail({
        kind: "body-file-refused",
        location: "../keys/credentials.json",
        reason: "inside-credential-store",
      }),
    );
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it("refuses a file holding a private key wherever it lives", async () => {
    const { readBodyFile } = readerFor({
      paths: { "rin-author.pem": "H:/Development/rin/keys/rin-author.pem" },
      fileText: "-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----\n",
    });

    expect(await readBodyFile("rin-author.pem")).toEqual(
      fail({ kind: "body-file-refused", location: "rin-author.pem", reason: "contains-private-key" }),
    );
  });

  it("reports a body file that does not exist", async () => {
    const { readBodyFile } = readerFor({ paths: {}, fileText: "" });

    expect(await readBodyFile("absent.md")).toEqual(
      fail({ kind: "body-file-unreadable", location: "absent.md" }),
    );
  });

  it("still guards private keys when the credential store cannot be located", async () => {
    const readBodyFile = createBodyFileReader({
      readTextFile: vi.fn<TextFileReader>().mockResolvedValue(succeed("-----BEGIN PRIVATE KEY-----")),
      resolveCanonicalPath: canonicalPaths({ "key.txt": "H:/shop/key.txt" }),
      locateCredentialStore: vi.fn<StoreLocator>().mockReturnValue(fail({ detail: "no home" })),
    });

    expect(await readBodyFile("key.txt")).toEqual(
      fail({ kind: "body-file-refused", location: "key.txt", reason: "contains-private-key" }),
    );
  });
});
