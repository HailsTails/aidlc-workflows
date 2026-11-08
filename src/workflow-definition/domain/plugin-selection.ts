import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { Contribution } from "./contribution.ts";
import type { PluginId, Owner } from "./identities.ts";
import type { PluginSelection } from "./method.ts";
import type { MethodRefusal } from "./refusals.ts";

export const pluginNamespaceIssues = (name: string): readonly MethodRefusal[] =>
  name === "aidlc" || name.startsWith("aidlc-")
    ? [{ kind: "core-namespace-claimed", plugin: name }] : [];

type PreparedContributions = { readonly ordered: readonly Contribution[];
  readonly selected: readonly PluginId[] };

const manifestIssue = (plugin: string, issue: string): MethodRefusal => ({ kind: "invalid-file",
  location: { kind: "plugin-manifest", plugin }, issues: [issue] });

const contributionIssues = (contributions: readonly Contribution[]): readonly MethodRefusal[] =>
  contributions.flatMap((contribution, index) => {
    const identities = contributions.map((entry) => entry.plugin);
    return [
      ...pluginNamespaceIssues(contribution.plugin),
      ...(identities.slice(0, index).includes(contribution.plugin)
        ? [manifestIssue(contribution.plugin, "Several contributions claim this plugin identity.")]
        : []),
      ...contribution.dependsOn.flatMap((dependency) => dependency.kind === "plugin"
        && !identities.includes(dependency.plugin) ? [{ kind: "missing-dependency" as const,
          plugin: contribution.plugin, needs: dependency.plugin }] : []),
    ];
  });

const orderContributions = (pending: readonly Contribution[], ordered: readonly Contribution[]):
  Result<readonly Contribution[], readonly MethodRefusal[]> => {
  if (pending.length === 0) return accepted(ordered);
  const next = pending.filter((contribution) => contribution.dependsOn.every((dependency) =>
    dependency.kind === "core" || ordered.some((prior) => prior.plugin === dependency.plugin)))
    .toSorted((left, right) => left.plugin.localeCompare(right.plugin))[0];
  return next ? orderContributions(pending.filter((entry) => entry !== next), [...ordered, next])
    : refused(pending.map((entry) => manifestIssue(entry.plugin,
      "Plugin dependencies form a cycle.")));
};

const closure = (ordered: readonly Contribution[], requested: readonly PluginId[]):
  readonly PluginId[] => {
  const expanded = [...new Set([...requested, ...ordered.filter((entry) =>
    requested.includes(entry.plugin)).flatMap((entry) => entry.dependsOn.flatMap((dependency) =>
    dependency.kind === "plugin" ? [dependency.plugin] : []))])];
  return expanded.length === requested.length ? expanded : closure(ordered, expanded);
};

export const prepareContributions = (request: { readonly contributions: readonly Contribution[];
  readonly selection: PluginSelection }): Result<PreparedContributions, readonly MethodRefusal[]> => {
  const issues = contributionIssues(request.contributions);
  if (issues.length > 0) return refused(issues);
  const ordered = orderContributions(request.contributions, []);
  if (!ordered.ok) return ordered;
  if (request.selection.kind === "every-installed") return accepted({ ordered: ordered.value,
    selected: ordered.value.map((entry) => entry.plugin) });
  const missing = request.selection.plugins.filter((plugin) =>
    !ordered.value.some((entry) => entry.plugin === plugin));
  return missing.length > 0 ? refused(missing.map((plugin) =>
    manifestIssue(plugin, "Selected plugin is not installed.")))
    : accepted({ ordered: ordered.value, selected: closure(ordered.value, request.selection.plugins) });
};

export const ownerEnabled = (request: { readonly owner: Owner;
  readonly selection: PluginSelection; readonly selected: readonly PluginId[] }) =>
  request.owner.kind === "plugin" ? request.selected.includes(request.owner.plugin)
    : request.owner.kind === "core" && (request.selection.kind === "every-installed"
      || request.selection.core === "included");
