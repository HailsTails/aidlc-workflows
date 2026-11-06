// covers: file:core/tools/aidlc-practices-promotion.ts, function:practicesRulesToAdd, function:planPracticesPromotion, function:promotePractices, function:createPracticesPromotionRepository, function:createPracticesFiles, function:createPracticesContent

import { expect, mock, test, type Mock } from "bun:test";
import {
  practicesRulesToAdd, planPracticesPromotion, promotePractices, createPracticesContent, createPracticesFiles, createPracticesPromotionRepository,
  type PracticesAffirmation, type PracticesContentPort, type PracticesContentBindings, type PracticesPromotionInputs,
  type PracticesPromotionRepository, type PracticesPromotionSummary, type PracticesFilesPort, type PracticesFileBindings, type PracticesPromotionLocation,
} from "./aidlc-practices-promotion.ts";

const INPUTS: PracticesPromotionInputs = { kind: "loaded", teamPractices: "draft", discoveredRules: "rules", team: "team", project: "project" };
interface PromotionFixture {
  content: {
    section: Mock<PracticesContentPort["section"]>;
    ruleItems: Mock<PracticesContentPort["ruleItems"]>;
    replaceTeamSection: Mock<PracticesContentPort["replaceTeamSection"]>;
    appendProjectRule: Mock<PracticesContentPort["appendProjectRule"]>;
  };
  repository: {
    read: Mock<PracticesPromotionRepository["read"]>;
    writeProject: Mock<PracticesPromotionRepository["writeProject"]>;
    writeTeam: Mock<PracticesPromotionRepository["writeTeam"]>;
  };
  commitAffirmation: Mock<(summary: PracticesPromotionSummary) => PracticesAffirmation>;
  today: string;
}
function fixture(): PromotionFixture {
  return {
    content: {
      section: mock<PracticesContentPort["section"]>().mockReturnValue(""),
      ruleItems: mock<PracticesContentPort["ruleItems"]>().mockReturnValue([]),
      replaceTeamSection: mock<PracticesContentPort["replaceTeamSection"]>().mockReturnValue({ kind: "prepared", content: "new team" }),
      appendProjectRule: mock<PracticesContentPort["appendProjectRule"]>().mockReturnValue({ kind: "prepared", content: "new project" }),
    },
    repository: {
      read: mock<PracticesPromotionRepository["read"]>().mockReturnValue(INPUTS),
      writeProject: mock<PracticesPromotionRepository["writeProject"]>().mockReturnValue({ kind: "written" }),
      writeTeam: mock<PracticesPromotionRepository["writeTeam"]>().mockReturnValue({ kind: "written" }),
    },
    commitAffirmation: mock<(summary: PracticesPromotionSummary) => PracticesAffirmation>().mockReturnValue({ kind: "affirmed", affirmedAt: "2026-11-06T12:00:00Z" }),
    today: "2026-11-06",
  };
}

  test("deduplicates rules and terminal dates within their own category", () => {
    const { content } = fixture();
    content.section.mockReturnValueOnce("Run tests (affirmed 2026-01-01)").mockReturnValueOnce("draft").mockReturnValueOnce("").mockReturnValueOnce("draft");
    content.ruleItems.mockReturnValueOnce(["Run tests (affirmed 2026-02-01)", "Review changes", "Review changes"]).mockReturnValueOnce(["Run tests"]);
    expect(practicesRulesToAdd({ discoveredRules: "draft", projectMd: "project", content })).toEqual({ mandated: ["Review changes"], forbidden: ["Run tests"] });
  });

  test("only terminal dates are removed and empty items add no rule", () => {
    const { content } = fixture();
    content.ruleItems.mockReturnValueOnce(["", "Rule (affirmed 2026-01-01) (affirmed 2026-02-01)", "Rule (affirmed 2026-01-01) matters"]);
    expect(practicesRulesToAdd({ discoveredRules: "draft", projectMd: "project", content })).toEqual({ mandated: ["Rule", "Rule (affirmed 2026-01-01) matters"], forbidden: [] });
  });

  test("absent team sections remain unchanged and produce no section updates", () => {
    const request = fixture();
    expect(planPracticesPromotion({ ...request, inputs: INPUTS })).toEqual({ kind: "planned", team: "team", project: "project", sectionsWritten: [], rulesAppended: { mandated: 0, forbidden: 0 } });
    expect(request.content.replaceTeamSection).not.toHaveBeenCalled();
  });

  test("a present area delegates interpretation and replacement to the content owner", () => {
    const request = fixture();
    request.content.section.mockReturnValueOnce("new practice");
    expect(planPracticesPromotion({ ...request, inputs: INPUTS })).toMatchObject({ kind: "planned", team: "new team", sectionsWritten: ["Way of Working"] });
    expect(request.content.replaceTeamSection).toHaveBeenCalledWith({ current: "team", heading: "## Way of Working", section: "new practice" });
  });

  test("content refusal stops planning before project rule application", () => {
    const request = fixture();
    request.content.section.mockReturnValueOnce("invalid practice");
    request.content.replaceTeamSection.mockReturnValueOnce({ kind: "failed", stage: "plan", applied: "none", reason: "invalid posture" });
    expect(planPracticesPromotion({ ...request, inputs: INPUTS })).toEqual({ kind: "failed", stage: "plan", applied: "none", reason: "invalid posture" });
    expect(request.content.ruleItems).not.toHaveBeenCalled();
  });

  test("new rules are stamped once and counted from the exact additions", () => {
    const request = fixture();
    request.content.ruleItems.mockReturnValueOnce(["Run tests"]).mockReturnValueOnce(["Commit secrets"]);
    expect(planPracticesPromotion({ ...request, inputs: INPUTS })).toMatchObject({ kind: "planned", project: "new project", rulesAppended: { mandated: 1, forbidden: 1 } });
    expect(request.content.appendProjectRule).toHaveBeenNthCalledWith(1, { current: "project", heading: "## Mandated", rule: "- Run tests (affirmed 2026-11-06)\n" });
    expect(request.content.appendProjectRule).toHaveBeenNthCalledWith(2, { current: "new project", heading: "## Forbidden", rule: "- Commit secrets (affirmed 2026-11-06)\n" });
  });

  test("a failed rule append prevents later append attempts", () => {
    const request = fixture();
    request.content.ruleItems.mockReturnValueOnce(["First", "Second"]);
    request.content.appendProjectRule.mockReturnValueOnce({ kind: "failed", stage: "plan", applied: "none", reason: "missing heading" });
    expect(planPracticesPromotion({ ...request, inputs: INPUTS })).toEqual({ kind: "failed", stage: "plan", applied: "none", reason: "missing heading" });
    expect(request.content.appendProjectRule).toHaveBeenCalledTimes(1);
  });

  test("success applies both documents and sends the actual summary to affirmation", () => {
    const request = fixture();
    expect(promotePractices(request)).toEqual({ kind: "promoted", sectionsWritten: [], rulesAppended: { mandated: 0, forbidden: 0 }, affirmedAt: "2026-11-06T12:00:00Z" });
    expect(request.repository.writeProject).toHaveBeenCalledWith({ content: "project" });
    expect(request.repository.writeTeam).toHaveBeenCalledWith({ content: "team" });
    expect(request.commitAffirmation).toHaveBeenCalledWith({ sectionsWritten: [], rulesAppended: { mandated: 0, forbidden: 0 } });
  });

  test("read failure makes no writes or affirmation", () => {
    const request = fixture();
    request.repository.read.mockReturnValueOnce({ kind: "failed", stage: "load", applied: "none", reason: "missing draft" });
    expect(promotePractices(request)).toEqual({ kind: "failed", stage: "load", applied: "none", reason: "missing draft" });
    expect(request.repository.writeProject).not.toHaveBeenCalled();
    expect(request.commitAffirmation).not.toHaveBeenCalled();
  });

  test("project failure leaves team and affirmation untouched", () => {
    const request = fixture();
    request.repository.writeProject.mockReturnValueOnce({ kind: "failed", stage: "project-write", applied: "none", reason: "project failed" });
    expect(promotePractices(request)).toEqual({ kind: "failed", stage: "project-write", applied: "none", reason: "project failed" });
    expect(request.repository.writeTeam).not.toHaveBeenCalled();
    expect(request.commitAffirmation).not.toHaveBeenCalled();
  });

  test("team failure reports partial project application and does not affirm", () => {
    const request = fixture();
    request.repository.writeTeam.mockReturnValueOnce({ kind: "failed", stage: "team-write", applied: "project", reason: "team failed" });
    expect(promotePractices(request)).toEqual({ kind: "failed", stage: "team-write", applied: "project", reason: "team failed" });
    expect(request.repository.writeProject).toHaveBeenCalledTimes(1);
    expect(request.commitAffirmation).not.toHaveBeenCalled();
  });

  test("affirmation failure reports that both documents remain applied", () => {
    const request = fixture();
    request.commitAffirmation.mockReturnValueOnce({ kind: "failed", stage: "affirmation", applied: "both", reason: "state failed" });
    expect(promotePractices(request)).toEqual({ kind: "failed", stage: "affirmation", applied: "both", reason: "state failed" });
    expect(request.repository.writeProject).toHaveBeenCalledTimes(1);
    expect(request.repository.writeTeam).toHaveBeenCalledTimes(1);
  });
test("the default content factory normalizes Testing Posture before replacing its section", () => {
  const testingPosture = mock<PracticesContentBindings["testingPosture"]>().mockReturnValue({ section: "normalized", problem: null });
  const replaceSection = mock<PracticesContentBindings["replaceSection"]>().mockReturnValue("new team");
  const content = createPracticesContent({
    section: mock<PracticesContentBindings["section"]>().mockReturnValue(""),
    ruleItems: mock<PracticesContentBindings["ruleItems"]>().mockReturnValue([]),
    testingPosture, replaceSection,
    appendRule: mock<PracticesContentBindings["appendRule"]>().mockReturnValue(""),
    describeFailure: mock<PracticesContentBindings["describeFailure"]>().mockReturnValue("failure"),
  });
  expect(content.replaceTeamSection({ current: "old", heading: "## Testing Posture", section: "draft" })).toEqual({ kind: "prepared", content: "new team" });
  expect(testingPosture).toHaveBeenCalledWith({ section: "draft" });
  expect(replaceSection).toHaveBeenCalledWith({ current: "old", heading: "## Testing Posture", section: "normalized" });
});

test("the default content factory refuses an invalid posture before replacement", () => {
  const replaceSection = mock<PracticesContentBindings["replaceSection"]>().mockReturnValue("new team");
  const content = createPracticesContent({
    section: mock<PracticesContentBindings["section"]>().mockReturnValue(""),
    ruleItems: mock<PracticesContentBindings["ruleItems"]>().mockReturnValue([]),
    testingPosture: mock<PracticesContentBindings["testingPosture"]>().mockReturnValue({ section: "draft", problem: "invalid posture" }),
    replaceSection,
    appendRule: mock<PracticesContentBindings["appendRule"]>().mockReturnValue(""),
    describeFailure: mock<PracticesContentBindings["describeFailure"]>().mockReturnValue("failure"),
  });
  expect(content.replaceTeamSection({ current: "old", heading: "## Testing Posture", section: "draft" })).toEqual({ kind: "failed", stage: "plan", applied: "none", reason: "invalid posture" });
  expect(replaceSection).not.toHaveBeenCalled();
});

interface FilesFixture {
  location: PracticesPromotionLocation;
  files: { presence: Mock<PracticesFilesPort["presence"]>; read: Mock<PracticesFilesPort["read"]>; write: Mock<PracticesFilesPort["write"]> };
}
function filesFixture(): FilesFixture {
  return {
    location: { teamPracticesPath: "draft/team.md", discoveredRulesPath: "draft/rules.md", teamPath: "memory/team.md", projectPath: "memory/project.md", draftDirectory: "same", contributions: mock<PracticesPromotionLocation["contributions"]>().mockReturnValue([]) },
    files: {
      presence: mock<PracticesFilesPort["presence"]>().mockReturnValue("present"),
      read: mock<PracticesFilesPort["read"]>().mockReturnValue({ kind: "read", content: "text" }),
      write: mock<PracticesFilesPort["write"]>().mockReturnValue({ kind: "written" }),
    },
  };
}

  test("different draft directories refuse before resolving collaborators or reading files", () => {
    const request = filesFixture();
    const repository = createPracticesPromotionRepository({ ...request, location: { ...request.location, draftDirectory: "different" } });
    expect(repository.read()).toEqual({ kind: "failed", stage: "evidence", applied: "none", reason: "team-practices and discovered-rules drafts must share one stage directory" });
    expect(request.location.contributions).not.toHaveBeenCalled();
    expect(request.files.read).not.toHaveBeenCalled();
  });

  test("missing contribution refuses before reading drafts", () => {
    const request = filesFixture();
    request.files.read.mockReturnValueOnce({ kind: "unreadable", detail: "missing" });
    const repository = createPracticesPromotionRepository({ ...request, location: { ...request.location, contributions: mock<PracticesPromotionLocation["contributions"]>().mockReturnValue([{ agent: "quality", path: "draft/contributions/quality.md" }]) } });
    expect(repository.read()).toEqual({ kind: "failed", stage: "evidence", applied: "none", reason: "ensemble evidence is incomplete: quality (no contribution file)" });
    expect(request.files.presence).not.toHaveBeenCalled();
  });

  test("a marker on a later line does not establish collaborator identity", () => {
    const request = filesFixture();
    request.files.read.mockReturnValueOnce({ kind: "read", content: "# Notes\n**Collaborator:** quality\n" });
    const repository = createPracticesPromotionRepository({ ...request, location: { ...request.location, contributions: mock<PracticesPromotionLocation["contributions"]>().mockReturnValue([{ agent: "quality", path: "draft/contributions/quality.md" }]) } });
    expect(repository.read()).toEqual({ kind: "failed", stage: "evidence", applied: "none", reason: "ensemble evidence is incomplete: quality (missing identity-marker first line)" });
  });

  test("valid CRLF collaborator marker allows one four-document snapshot", () => {
    const request = filesFixture();
    request.files.read.mockReturnValueOnce({ kind: "read", content: "**Collaborator:** quality\r\n" });
    const repository = createPracticesPromotionRepository({ ...request, location: { ...request.location, contributions: mock<PracticesPromotionLocation["contributions"]>().mockReturnValue([{ agent: "quality", path: "draft/contributions/quality.md" }]) } });
    expect(repository.read()).toEqual({ kind: "loaded", teamPractices: "text", discoveredRules: "text", team: "text", project: "text" });
    expect(request.files.read).toHaveBeenNthCalledWith(1, { path: "draft/contributions/quality.md" });
    expect(request.files.read).toHaveBeenNthCalledWith(5, { path: "memory/project.md" });
  });

  test("lead-only selection requires no contributions", () => {
    const request = filesFixture();
    expect(createPracticesPromotionRepository(request).read()).toEqual({ kind: "loaded", teamPractices: "text", discoveredRules: "text", team: "text", project: "text" });
    expect(request.files.read).toHaveBeenCalledTimes(4);
  });

  test("missing first draft keeps the established reason and does not read", () => {
    const request = filesFixture();
    request.files.presence.mockReturnValueOnce("absent");
    expect(createPracticesPromotionRepository(request).read()).toEqual({ kind: "failed", stage: "load", applied: "none", reason: "team-practices draft not found: draft/team.md" });
    expect(request.files.read).not.toHaveBeenCalled();
  });

  test("missing project target refuses after reading drafts but before reading targets", () => {
    const request = filesFixture();
    request.files.presence.mockReturnValueOnce("present").mockReturnValueOnce("present").mockReturnValueOnce("present").mockReturnValueOnce("absent");
    expect(createPracticesPromotionRepository(request).read()).toEqual({ kind: "failed", stage: "load", applied: "none", reason: "project.md not found at memory/project.md" });
    expect(request.files.read).toHaveBeenCalledTimes(2);
    expect(request.files.write).not.toHaveBeenCalled();
  });

  test("read failure is data with its existing draft context", () => {
    const request = filesFixture();
    request.files.read.mockReturnValueOnce({ kind: "unreadable", detail: "denied" });
    expect(createPracticesPromotionRepository(request).read()).toEqual({ kind: "failed", stage: "load", applied: "none", reason: "could not read drafts: denied" });
    expect(request.files.write).not.toHaveBeenCalled();
  });

  test("project write failure has no prior application", () => {
    const request = filesFixture();
    request.files.write.mockReturnValueOnce({ kind: "unwritable", detail: "denied" });
    expect(createPracticesPromotionRepository(request).writeProject({ content: "new" })).toEqual({ kind: "failed", stage: "project-write", applied: "none", reason: "writing project.md failed: denied" });
    expect(request.files.write).toHaveBeenCalledWith({ path: "memory/project.md", content: "new" });
  });

  test("team write failure reports partial project application", () => {
    const request = filesFixture();
    request.files.write.mockReturnValueOnce({ kind: "unwritable", detail: "denied" });
    expect(createPracticesPromotionRepository(request).writeTeam({ content: "new" })).toEqual({ kind: "failed", stage: "team-write", applied: "project", reason: "writing team.md failed AFTER project.md was written: denied" });
  });
test("the default file factory returns owned read and write outcomes", () => {
  const readText = mock<PracticesFileBindings["readText"]>().mockReturnValue("file text");
  const writeText = mock<PracticesFileBindings["writeText"]>().mockReturnValue(undefined);
  const files = createPracticesFiles({
    presence: mock<PracticesFileBindings["presence"]>().mockReturnValue("present"),
    readText, writeText,
    describeFailure: mock<PracticesFileBindings["describeFailure"]>().mockReturnValue("failure"),
  });
  expect(files.read({ path: "memory/team.md" })).toEqual({ kind: "read", content: "file text" });
  expect(files.write({ path: "memory/team.md", content: "new" })).toEqual({ kind: "written" });
  expect(readText).toHaveBeenCalledWith({ path: "memory/team.md" });
  expect(writeText).toHaveBeenCalledWith({ path: "memory/team.md", content: "new" });
});