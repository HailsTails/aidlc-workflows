import { createHash } from "node:crypto";

type ContentDigestPort = {
  readonly sha256Hex: (input: { readonly content: Uint8Array | string }) => string;
};

const defaultContentDigestPort = (): ContentDigestPort => ({
  sha256Hex: ({ content }) => createHash("sha256").update(content).digest("hex"),
});

export type { ContentDigestPort };
export { defaultContentDigestPort };
