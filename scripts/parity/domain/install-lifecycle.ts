import type { Finding } from "./outcome.ts";

export type FileTree = Readonly<Record<string, string>>;

export type TreeChange = {
  readonly added: FileTree;
  readonly changed: FileTree;
  readonly removed: readonly string[];
};

export type StepResult = {
  readonly exitCode: number;
  readonly change: TreeChange;
};

export type LifecycleRecord = {
  readonly harness: string;
  readonly release: string;
  readonly previousRelease: string;
  readonly fresh: { readonly exitCode: number; readonly tree: FileTree };
  readonly refresh: StepResult;
  readonly localEdit: StepResult & { readonly file: string; readonly named: boolean };
  readonly force: StepResult;
  readonly upgrade: StepResult & { readonly previousExitCode: number };
};

type Comparison<T> = { readonly label: string; readonly expected: T; readonly actual: T };

const pick = (tree: FileTree, keep: (path: string) => boolean): FileTree =>
  Object.fromEntries(Object.entries(tree).filter(([path]) => keep(path)));

export const changeBetween = (before: FileTree, after: FileTree): TreeChange => ({
  added: pick(after, (path) => before[path] === undefined),
  changed: pick(after, (path) => before[path] !== undefined && before[path] !== after[path]),
  removed: Object.keys(before).filter((path) => after[path] === undefined),
});

const differingPaths = (expected: FileTree, actual: FileTree): readonly string[] =>
  [...new Set([...Object.keys(expected), ...Object.keys(actual)])]
    .filter((path) => expected[path] !== actual[path])
    .toSorted((left, right) => left.localeCompare(right));

const treeDrift = (comparison: Comparison<FileTree>): readonly Finding[] =>
  differingPaths(comparison.expected, comparison.actual).map((path) => ({
    subject: `${comparison.label} · ${path}`,
    violation: "differs from the recorded install",
    fix:
      "Make the installer produce the recorded tree, or re-record with --record when the " +
      "change is intended and reviewed.",
  }));

const valueDrift = (comparison: Comparison<number | string | boolean>): readonly Finding[] =>
  comparison.expected === comparison.actual
    ? []
    : [
        {
          subject: comparison.label,
          violation: `is ${String(comparison.actual)}, recorded ${String(comparison.expected)}`,
          fix: "Restore the recorded behaviour, or re-record with --record when it is intended.",
        },
      ];

const asTree = (change: TreeChange): FileTree => ({
  ...pick(change.added, () => true),
  ...Object.fromEntries(Object.entries(change.changed).map(([path, hash]) => [path, `~${hash}`])),
  ...Object.fromEntries(change.removed.map((path) => [path, "removed"])),
});

const stepDrift = (comparison: Comparison<StepResult>): readonly Finding[] => [
  ...valueDrift({
    label: `${comparison.label} exit code`,
    expected: comparison.expected.exitCode,
    actual: comparison.actual.exitCode,
  }),
  ...treeDrift({
    label: comparison.label,
    expected: asTree(comparison.expected.change),
    actual: asTree(comparison.actual.change),
  }),
];

type Sides<T> = { readonly expected: T; readonly actual: T };

const sidesOf =
  (records: Comparison<LifecycleRecord>) =>
  <T>(read: (record: LifecycleRecord) => T): Sides<T> => ({
    expected: read(records.expected),
    actual: read(records.actual),
  });

export const lifecycleDrift = (comparison: Comparison<LifecycleRecord>): readonly Finding[] => {
  const side = sidesOf(comparison);
  const { label } = comparison;
  return [
    ...valueDrift({ label: `${label} fresh exit code`, ...side((r) => r.fresh.exitCode) }),
    ...treeDrift({ label: `${label} fresh`, ...side((r) => r.fresh.tree) }),
    ...stepDrift({ label: `${label} refresh`, ...side((r) => r.refresh) }),
    ...stepDrift({ label: `${label} local edit`, ...side((r) => r.localEdit) }),
    ...valueDrift({
      label: `${label} local edit names the file`,
      ...side((r) => r.localEdit.named),
    }),
    ...stepDrift({ label: `${label} force`, ...side((r) => r.force) }),
    ...stepDrift({ label: `${label} upgrade`, ...side((r) => r.upgrade) }),
    ...valueDrift({
      label: `${label} previous install exit code`,
      ...side((r) => r.upgrade.previousExitCode),
    }),
  ];
};
