import type { SkillTableRenderer } from "./neutral-surface.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";

const regions = [
  { verb: "stage-table", begin: "<!-- BEGIN: compiled stage graph via ", end: "<!-- END: compiled stage graph -->" },
  { verb: "scope-table", begin: "<!-- BEGIN: compiled scope grid via ", end: "<!-- END: compiled scope grid -->" },
] as const;

export const refreshSkillRegions = (request: {
  readonly text: string;
  readonly render: SkillTableRenderer;
}): Result<string, string> => regions.reduce<Result<string, string>>((previous, region) => {
  if (!previous.ok) return previous;
  const rendered = request.render(region.verb);
  if (!rendered.ok) return rendered;
  const text = previous.value;
  const begin = text.indexOf(region.begin);
  const end = text.indexOf(region.end);
  if (begin === -1 && end === -1) return previous;
  if (begin === -1 || end === -1 || end < begin
    || text.lastIndexOf(region.begin) !== begin || text.lastIndexOf(region.end) !== end) {
    return refused(`malformed ${region.verb} markers`);
  }
  return accepted(text.slice(0, begin) + rendered.value.trimEnd() + text.slice(end + region.end.length));
}, accepted(request.text.replace(/\r\n/g, "\n")));

export const EARLIER_RELEASE_REGIONS =
  "<!-- BEGIN: compiled scope grid via an earlier release's refresh -->" +
  "<!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph -->" +
  "<!-- END: compiled scope grid -->";

export const earlierReleaseRegionsPolicy = (request: {
  readonly skillRel: string;
  readonly harnessDir: string;
}): "include" | "omit" => {
  const rel = request.skillRel.split(/[\\/]/).join("/");
  return rel === `${request.harnessDir}/skills/aidlc/SKILL.md`
    || rel === ".agents/skills/aidlc/SKILL.md" ? "include" : "omit";
};
export const finishEarlierReleaseSkill = (request: {
  readonly text: string;
  readonly skillRel: string;
  readonly harnessDir: string;
}): string => earlierReleaseRegionsPolicy(request) === "include"
  ? `${request.text.replace(/\n*$/, "")}\n\n${EARLIER_RELEASE_REGIONS}\n` : request.text;
