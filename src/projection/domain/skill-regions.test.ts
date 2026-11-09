import { expect, mock, test } from "bun:test";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { refreshSkillRegions, earlierReleaseRegionsPolicy, finishEarlierReleaseSkill } from "./skill-regions.ts";

test("stage then scope formatting happens even when markers are absent", () => {
  const render = mock<(verb: string) => Result<string, string>>(() => accepted("unused\n"));
  expect(refreshSkillRegions({ text: "Authored\r\n", render })).toEqual(accepted("Authored\n"));
  expect(render.mock.calls).toEqual([["stage-table"], ["scope-table"]]);
});

test("replacement keeps surrounding prose and uses the frozen canonical region whole", () => {
  const render = mock(() => accepted("unused"))
    .mockReturnValueOnce(accepted("<!-- BEGIN: compiled stage graph via generated -->\nStage\n<!-- END: compiled stage graph -->\n"))
    .mockReturnValueOnce(accepted("<!-- BEGIN: compiled scope grid via generated -->\nScope\n<!-- END: compiled scope grid -->\n"));
  expect(refreshSkillRegions({ text: "Before\r\n<!-- BEGIN: compiled stage graph via old -->\nold\n<!-- END: compiled stage graph -->\nBetween\n<!-- BEGIN: compiled scope grid via old -->\nold\n<!-- END: compiled scope grid -->\nAfter\n", render }))
    .toEqual(accepted("Before\n<!-- BEGIN: compiled stage graph via generated -->\nStage\n<!-- END: compiled stage graph -->\nBetween\n<!-- BEGIN: compiled scope grid via generated -->\nScope\n<!-- END: compiled scope grid -->\nAfter\n"));
});

test("formatter failure precedes malformed-marker validation and stops the scope call", () => {
  const render = mock(() => refused("Formatter unavailable"));
  expect(refreshSkillRegions({ text: "<!-- END: compiled stage graph -->", render }))
    .toEqual(refused("Formatter unavailable"));
  expect(render).toHaveBeenCalledTimes(1);
});

test("duplicate and reversed markers refuse without a partial document", () => {
  expect(refreshSkillRegions({ text: "<!-- BEGIN: compiled stage graph via a --><!-- BEGIN: compiled stage graph via b --><!-- END: compiled stage graph -->",
    render: () => accepted("Stage") })).toEqual(refused("malformed stage-table markers"));
  expect(refreshSkillRegions({ text: "<!-- END: compiled scope grid --><!-- BEGIN: compiled scope grid via a -->",
    render: () => accepted("Stage") })).toEqual(refused("malformed scope-table markers"));
});

test("earlier release compatibility keeps native and .agents locations and excludes Copilot", () => {
  expect(earlierReleaseRegionsPolicy({ skillRel: ".claude\\skills\\aidlc\\SKILL.md", harnessDir: ".claude" }))
    .toBe("include");
  expect(earlierReleaseRegionsPolicy({ skillRel: ".agents/skills/aidlc/SKILL.md", harnessDir: ".codex" }))
    .toBe("include");
  expect(earlierReleaseRegionsPolicy({ skillRel: ".github/skills/aidlc/SKILL.md", harnessDir: ".copilot" }))
    .toBe("omit");
  expect(finishEarlierReleaseSkill({ text: "Copilot\n\n", skillRel: ".github/skills/aidlc/SKILL.md",
    harnessDir: ".copilot" })).toBe("Copilot\n\n");
});
