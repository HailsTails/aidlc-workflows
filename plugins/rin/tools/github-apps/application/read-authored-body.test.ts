import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { readAuthoredBody } from "./read-authored-body.ts";
import type { BodyFileReader } from "./read-body-file.ts";

const USER_TOKEN_BODY = `Uploaded with ghu_${"a".repeat(36)}`;

const sources = () => ({
  readBodyFile: vi.fn<BodyFileReader>().mockResolvedValue(succeed("From the file.")),
  readStandardInput: vi.fn<() => Promise<string>>().mockResolvedValue("From stdin."),
});

describe("readAuthoredBody", () => {
  it("has no body when none was given", async () => {
    expect(await readAuthoredBody({ ...sources(), source: undefined })).toEqual(succeed(undefined));
  });

  it("takes inline text as given", async () => {
    expect(await readAuthoredBody({ ...sources(), source: { kind: "inline", text: "Hi." } })).toEqual(
      succeed("Hi."),
    );
  });

  it("refuses inline text carrying a private key", async () => {
    expect(
      await readAuthoredBody({
        ...sources(),
        source: { kind: "inline", text: "-----BEGIN PRIVATE KEY-----" },
      }),
    ).toEqual(fail({ kind: "inline-body-refused", reason: "contains-private-key" }));
  });

  it("refuses inline text carrying a user token", async () => {
    expect(
      await readAuthoredBody({ ...sources(), source: { kind: "inline", text: USER_TOKEN_BODY } }),
    ).toEqual(fail({ kind: "inline-body-refused", reason: "contains-github-token" }));
  });

  it("takes inline text that only names the token prefixes", async () => {
    expect(
      await readAuthoredBody({
        ...sources(),
        source: { kind: "inline", text: "Uses a ghu_ token." },
      }),
    ).toEqual(succeed("Uses a ghu_ token."));
  });

  it("reads standard input", async () => {
    expect(await readAuthoredBody({ ...sources(), source: { kind: "standard-input" } })).toEqual(
      succeed("From stdin."),
    );
  });

  it("refuses standard input carrying a private key", async () => {
    expect(
      await readAuthoredBody({
        readBodyFile: vi.fn<BodyFileReader>(),
        readStandardInput: vi.fn<() => Promise<string>>().mockResolvedValue("-----BEGIN PRIVATE KEY-----"),
        source: { kind: "standard-input" },
      }),
    ).toEqual(fail({ kind: "inline-body-refused", reason: "contains-private-key" }));
  });

  it("refuses standard input carrying a user token", async () => {
    expect(
      await readAuthoredBody({
        readBodyFile: vi.fn<BodyFileReader>(),
        readStandardInput: vi.fn<() => Promise<string>>().mockResolvedValue(USER_TOKEN_BODY),
        source: { kind: "standard-input" },
      }),
    ).toEqual(fail({ kind: "inline-body-refused", reason: "contains-github-token" }));
  });

  it("reads a body file through the guarded reader", async () => {
    const authored = sources();

    await readAuthoredBody({ ...authored, source: { kind: "file", location: "note.md" } });

    expect(authored.readBodyFile).toHaveBeenCalledExactlyOnceWith("note.md");
  });
});
