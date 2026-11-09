import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { MarkdownOutliner, FrontmatterParser } from "../application/ports.ts";
import type { Overlay, OverlayAnchor, OverlayFragment, StageAdditions } from "../domain/contribution.ts";
import { agentSlug, artifactName, scopeName, sensorId, stageSlug } from "../domain/identities.ts";
import type { MethodSourceLocation } from "../domain/method-source.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import { authoredValue, decodeMarkdown, translated } from "./authored-markdown.ts";
import { OverlayFileSchema, type OverlayFile } from "./plugin-files.ts";
import { readPersonaAnchor, readStageAnchor } from "./read-overlay-anchor.ts";

type OverlayReading = Result<Overlay, readonly MethodRefusal[]>;

type FragmentRequest<Anchor extends OverlayAnchor> = {
  readonly source: MethodSourceLocation;
  readonly file: OverlayFile;
  readonly body: string;
  readonly outliner: MarkdownOutliner;
  readonly readAnchor: (source: MethodSourceLocation, raw: string) =>
    Result<Anchor, readonly MethodRefusal[]>;
};

const readFragments = <Anchor extends OverlayAnchor>(request: FragmentRequest<Anchor>):
  Result<readonly OverlayFragment<Anchor>[], readonly MethodRefusal[]> => {
  const headings = request.outliner.outline(request.body).headings
    .filter((heading) => heading.level === 2 && heading.title.startsWith("fragment: "));
  const fragments = request.file.fragments.map((fragment, index) => {
    const anchor = request.readAnchor(request.source, fragment.anchor);
    if (!anchor.ok) return anchor;
    const occurrence = request.file.fragments.slice(0, index)
      .filter((prior) => prior.anchor === fragment.anchor).length;
    const heading = headings.filter((entry) => entry.title === `fragment: ${fragment.anchor}`)
      [occurrence];
    if (!heading) return refused([{ kind: "invalid-file" as const,
      location: { kind: "method-source" as const, ...request.source },
      issues: [`Declared fragment ${fragment.anchor} occurrence ${occurrence + 1} has no body.`] }]);
    const end = headings[headings.indexOf(heading) + 1]?.start ?? request.body.length;
    return accepted({ anchor: anchor.value, order: fragment.order,
      text: request.body.slice(heading.contentStart, end).trim() });
  });
  const issues = fragments.flatMap((fragment) => fragment.ok ? [] : fragment.refusal);
  return issues.length > 0 ? refused(issues)
    : accepted(fragments.flatMap((fragment) => fragment.ok ? [fragment.value] : []));
};

const additionsOf = (file: OverlayFile): StageAdditions => ({
  produces: (file.adds?.produces ?? []).map((artifact) => ({
    artifact: authoredValue(artifactName(artifact)), obligation: "required", unitKinds: "all" })),
  consumes: (file.adds?.consumes ?? []).map((consumption) => ({
    artifact: authoredValue(artifactName(consumption.artifact)),
    obligation: consumption.required ? "required" : "optional", when: "always", citation: "uncited" })),
  sensors: (file.adds?.sensors ?? []).map((id) => authoredValue(sensorId(id))),
  scopes: (file.adds?.scopes ?? []).map((name) => authoredValue(scopeName(name))),
  requires: (file.adds?.requires_stage ?? []).map((slug) => authoredValue(stageSlug(slug))),
  requiredSections: file.adds?.required_sections ?? [],
});

export const readOverlay = (request: { readonly source: MethodSourceLocation;
  readonly raw: string; readonly outliner: MarkdownOutliner; readonly parser: FrontmatterParser }): OverlayReading => {
  const decoded = decodeMarkdown({ ...request, schema: OverlayFileSchema,
    strings: ["target", "plugin"] });
  if (!decoded.ok) return decoded;
  const { file, body: fragmentText } = decoded.value;
  if (request.source.owner.kind !== "plugin"
    || file.plugin !== request.source.owner.plugin) return refused([{ kind: "invalid-file",
      location: { kind: "method-source", ...request.source },
      issues: ["An overlay must declare its containing plugin as owner."] }]);
  if (request.source.path.startsWith("contributions/agents/")) {
    const fragments = readFragments({ ...request, file, body: fragmentText, readAnchor: readPersonaAnchor });
    return fragments.ok ? translated(request.source, () => ({ kind: "agent",
      agent: authoredValue(agentSlug(file.target)), fragments: fragments.value })) : fragments;
  }
  const fragments = readFragments({ ...request, file, body: fragmentText, readAnchor: readStageAnchor });
  return fragments.ok ? translated(request.source, () => ({ kind: "stage",
    stage: authoredValue(stageSlug(file.target)), adds: additionsOf(file), fragments: fragments.value }))
    : fragments;
};
