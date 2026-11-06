export type ProjectionPathAdmission =
  | { readonly kind: "accepted"; readonly path: string }
  | { readonly kind: "refused" };

// Projection metadata uses relative slash-separated paths; filesystem checks follow elsewhere.
export function checkProjectionPath({ path, scope = "relative-path" }: {
  readonly path: unknown;
  readonly scope?: "relative-path" | "top-level-name";
}): ProjectionPathAdmission {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.includes("\0") ||
    path.includes("\\") ||
    path.startsWith("/") ||
    /^[A-Za-z]:/.test(path) ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..") ||
    (scope === "top-level-name" && path.includes("/"))
  ) return { kind: "refused" };
  return { kind: "accepted", path };
}
