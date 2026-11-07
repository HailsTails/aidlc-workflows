type FrontmatterDeclaration = {
  readonly file: string;
  readonly lines: readonly string[];
};

export type CoreFileProjection = {
  readonly bindingScope: "own-harness" | "unchanged";
  readonly additions: readonly string[] | undefined;
};

export type CoreProjectionCoverage =
  | { readonly kind: "covered" }
  | { readonly kind: "missing-declarations"; readonly paths: readonly string[] };

// Repeated declarations retain their first position and their last supplied lines.
export function coreProjectionDeclarations({ declarations }: {
  readonly declarations: readonly FrontmatterDeclaration[];
}): ReadonlyMap<string, readonly string[]> {
  return new Map(declarations.map(({ file, lines }) => [file, lines]));
}

export function coreFileProjection({ path, declarations }: {
  readonly path: string;
  readonly declarations: ReadonlyMap<string, readonly string[]>;
}): CoreFileProjection {
  return {
    bindingScope: /^aidlc-common\/protocols\/[^/]+\.md$/.test(path) ? "own-harness" : "unchanged",
    additions: declarations.get(path),
  };
}

// Supplied paths are successful publications; the caller chooses when to check coverage.
export function coreProjectionCoverage({ declarations, publishedPaths }: {
  readonly declarations: ReadonlyMap<string, readonly string[]>;
  readonly publishedPaths: ReadonlySet<string>;
}): CoreProjectionCoverage {
  const paths = [...declarations.keys()].filter((path) => !publishedPaths.has(path));
  return paths.length === 0 ? { kind: "covered" } : { kind: "missing-declarations", paths };
}
