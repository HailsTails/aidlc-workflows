import type { WalkerCheck } from "../../../../../mechanisms/walker/runner/walker-check.ts";

export const check: Extract<WalkerCheck<unknown, unknown, unknown>, { readonly kind: "path" }> = {
  kind: "path",
  inspect: (request) => (request.file.endsWith(".tmp.ts") ? "violates" : "conforms"),
};
