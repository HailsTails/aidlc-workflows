// Core and retained projection suites are witnessed, but are not delivered production inputs.
// Explicit harness mappings and other authored assets retain conservative production selection.
export const authoredSourceRole = ({ path }: { readonly path: string }): "test" | "production" =>
  /^(?:core|scripts\/projection)\/.+\.test\.ts$/.test(path.replaceAll("\\", "/")) ? "test" : "production";
