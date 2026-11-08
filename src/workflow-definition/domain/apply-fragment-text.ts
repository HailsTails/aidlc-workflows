import type { OverlayAnchor, OverlayFragment } from "./contribution.ts";
import type { MethodFinding } from "./findings.ts";
import type { PluginId } from "./identities.ts";
import type { AuthoredBody } from "./outline.ts";
import { stageAnchorOffset } from "./overlay-anchor-offset.ts";

type MethodOutliner = (text: string) => AuthoredBody;
type OwnedFragment = { readonly plugin: PluginId; readonly target: "stage" | "agent";
  readonly name: string; readonly fragment: OverlayFragment<OverlayAnchor> };

export const fragmentOrder = (left: OwnedFragment, right: OwnedFragment): number =>
  left.fragment.order - right.fragment.order || left.plugin.localeCompare(right.plugin);

export const applyFragmentText = (request: { readonly body: AuthoredBody;
  readonly fragments: readonly OwnedFragment[]; readonly outline: MethodOutliner }):
  { readonly body: AuthoredBody; readonly findings: readonly MethodFinding[] } => {
  const placed = request.fragments.map((entry) => ({ ...entry,
    offset: entry.fragment.anchor.kind === "after-preflight"
      || entry.fragment.anchor.kind === "end-of-body" ? null
      : stageAnchorOffset(request.body, entry.fragment.anchor) }));
  const findings: readonly MethodFinding[] = placed.flatMap((entry) => entry.offset === null
    ? [{ kind: "overlay-dropped", plugin: entry.plugin, target: entry.target, name: entry.name,
      anchor: entry.fragment.anchor, reason: "anchor-not-found" }] : []);
  const text = placed.filter((entry): entry is typeof entry & { readonly offset: number } =>
    entry.offset !== null)
    .toSorted((left, right) => right.offset - left.offset
      || fragmentOrder(right, left)).reduce((body, entry) => {
      const offset = entry.offset;
      return `${body.slice(0, offset)}\n${entry.fragment.text}\n\n${body.slice(offset)}`;
    }, request.body.text);
  return { body: text === request.body.text ? request.body : request.outline(text), findings };
};
