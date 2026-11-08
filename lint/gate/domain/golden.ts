import type { Finding } from "./outcome.ts";

export type GoldenManifest = Readonly<Record<string, string>>;

export type GoldenSet = Readonly<Record<string, GoldenManifest>>;

export type GoldenChange = "added" | "removed" | "changed";

export type GoldenDrift = {
  readonly group: string;
  readonly path: string;
  readonly change: GoldenChange;
};

const changeOf = (expected: string | undefined, actual: string | undefined): GoldenChange => {
  if (expected === undefined) {
    return "added";
  }
  return actual === undefined ? "removed" : "changed";
};

const manifestDrift = (request: {
  readonly group: string;
  readonly expected: GoldenManifest;
  readonly actual: GoldenManifest;
}): readonly GoldenDrift[] => {
  const paths = [...new Set([...Object.keys(request.expected), ...Object.keys(request.actual)])];
  return paths
    .filter((path) => request.expected[path] !== request.actual[path])
    .sort()
    .map((path) => ({
      group: request.group,
      path,
      change: changeOf(request.expected[path], request.actual[path]),
    }));
};

export const goldenDrift = (request: {
  readonly expected: GoldenSet;
  readonly actual: GoldenSet;
}): readonly GoldenDrift[] => {
  const groups = [...new Set([...Object.keys(request.expected), ...Object.keys(request.actual)])];
  return groups.sort().flatMap((group) =>
    manifestDrift({
      group,
      expected: request.expected[group] ?? {},
      actual: request.actual[group] ?? {},
    }),
  );
};

export const driftFinding = (drift: GoldenDrift): Finding => ({
  subject: `${drift.group} · ${drift.path}`,
  violation: `${drift.change} against the golden output`,
  fix:
    "If the output change is deliberate, run `bun scripts/gate.ts --update-goldens` and " +
    "commit tests/golden with a decision line; otherwise restore the behaviour.",
});

export const goldenGroupOf = (request: {
  readonly path: string;
  readonly harnesses: readonly string[];
}): string | undefined => {
  const segments = request.path.split("/");
  const [root, first, , third] = segments;
  const candidate = root === "dist" && first === "plugins" ? third : first;
  const isOutputRoot = root === "dist" || root === "dist-release";
  return isOutputRoot && candidate !== undefined && request.harnesses.includes(candidate)
    ? candidate
    : undefined;
};
