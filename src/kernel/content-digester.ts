import type { ContentDigester } from "./content-digester-port.ts";
import { contentHash } from "./values.ts";

export type BunDigestLib = { readonly hexDigest: (message: string | Uint8Array) => string };

export type CreateBunContentDigesterArgs = { readonly digestLib?: BunDigestLib };

const bunSha256Digest: BunDigestLib = {
  hexDigest: (message) => new Bun.CryptoHasher("sha256").update(message).digest("hex"),
};

export const createBunContentDigester = (
  { digestLib = bunSha256Digest }: CreateBunContentDigesterArgs = {},
): ContentDigester => ({
  hash: (content) =>
    contentHash(`sha256:${digestLib.hexDigest(content.kind === "text" ? content.text : content.bytes)}`),
});
