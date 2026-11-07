// Independent fixture inventory keeps classification outside the native test bodies.
// It does not call the production fingerprint selector being qualified.
const fixtureRole = ({ path }: { readonly path: string }): "test" | "source" =>
  path.startsWith("scripts/projection/") && path.endsWith(".test.ts") ? "test" : "source";
export const projectionCurrencyCases = ({ paths }: { readonly paths: readonly string[] }): { readonly sources: readonly string[]; readonly tests: readonly string[] } => ({
  sources: paths.filter(path => fixtureRole({ path }) === "source"),
  tests: paths.filter(path => fixtureRole({ path }) === "test"),
});
