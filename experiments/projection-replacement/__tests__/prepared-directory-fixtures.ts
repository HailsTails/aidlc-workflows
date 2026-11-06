export const missingDirectoryError = (): Error & { readonly code: string } => Object.assign(new Error("synthetic absent directory"), { code: "ENOENT" });
