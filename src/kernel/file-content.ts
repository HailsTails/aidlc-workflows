export type FileMode = "regular" | "executable";

export type FileContent =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "bytes"; readonly bytes: Uint8Array };
