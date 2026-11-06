export const GENERATED_SKILL_REGIONS = [
  {
    verb: "stage-table",
    begin: "<!-- BEGIN: compiled stage graph via ",
    end: "<!-- END: compiled stage graph -->",
  },
  {
    verb: "scope-table",
    begin: "<!-- BEGIN: compiled scope grid via ",
    end: "<!-- END: compiled scope grid -->",
  },
] as const;

export type GeneratedSkillRegion = (typeof GENERATED_SKILL_REGIONS)[number];
export type GeneratedSkillRegionReplacement =
  | { readonly status: "ok"; readonly text: string }
  | { readonly status: "refused"; readonly detail: string };

export function replaceGeneratedSkillRegion({ text, rendered, region, path }: {
  readonly text: string;
  readonly rendered: string;
  readonly region: GeneratedSkillRegion;
  readonly path: string;
}): GeneratedSkillRegionReplacement {
  const beginIndex = text.indexOf(region.begin);
  const endIndex = text.indexOf(region.end);
  if (beginIndex === -1 && endIndex === -1) return { status: "ok", text };
  if (
    beginIndex === -1 ||
    endIndex === -1 ||
    endIndex < beginIndex ||
    text.lastIndexOf(region.begin) !== beginIndex ||
    text.lastIndexOf(region.end) !== endIndex
  ) return { status: "refused", detail: `packager: malformed ${region.verb} markers in ${path}` };
  return {
    status: "ok",
    text: text.slice(0, beginIndex) + rendered + text.slice(endIndex + region.end.length),
  };
}
