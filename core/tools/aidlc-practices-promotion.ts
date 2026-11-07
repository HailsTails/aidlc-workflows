export type PracticesPromotionFailure =
  | { kind: "failed"; stage: "evidence" | "load" | "plan" | "project-write"; applied: "none"; reason: string }
  | { kind: "failed"; stage: "team-write"; applied: "project"; reason: string }
  | { kind: "failed"; stage: "affirmation"; applied: "both"; reason: string };

export interface PracticesPromotionInputs {
  kind: "loaded";
  teamPractices: string;
  discoveredRules: string;
  team: string;
  project: string;
}

export interface PracticesRules {
  mandated: string[];
  forbidden: string[];
}

export interface PracticesPromotionSummary {
  sectionsWritten: string[];
  rulesAppended: { mandated: number; forbidden: number };
}

export interface PracticesPromotionPlan extends PracticesPromotionSummary {
  kind: "planned";
  team: string;
  project: string;
}

export type PracticesContentResult = { kind: "prepared"; content: string } | PracticesPromotionFailure;

export interface PracticesContentPort {
  section: (request: { markdown: string; heading: string }) => string;
  ruleItems: (request: { section: string }) => string[];
  replaceTeamSection: (request: { current: string; heading: string; section: string }) => PracticesContentResult;
  appendProjectRule: (request: { current: string; heading: string; rule: string }) => PracticesContentResult;
}

export interface PracticesContentBindings {
  section: PracticesContentPort["section"];
  ruleItems: PracticesContentPort["ruleItems"];
  testingPosture: (request: { section: string }) => { section: string; problem: string | null };
  replaceSection: (request: { current: string; heading: string; section: string }) => string;
  appendRule: (request: { current: string; heading: string; rule: string }) => string;
  describeFailure: (request: { failure: unknown }) => string;
}

export function createPracticesContent(bindings: PracticesContentBindings): PracticesContentPort {
  return {
    section: bindings.section,
    ruleItems: bindings.ruleItems,
    replaceTeamSection: ({ current, heading, section }) => {
      const promotable = heading === "## Testing Posture" ? bindings.testingPosture({ section }) : { section, problem: null };
      if (promotable.problem !== null) return { kind: "failed", stage: "plan", applied: "none", reason: promotable.problem };
      try {
        return { kind: "prepared", content: bindings.replaceSection({ current, heading, section: promotable.section }) };
      } catch (failure) {
        return { kind: "failed", stage: "plan", applied: "none", reason: `replaceSection failed on team.md for "${heading}": ${bindings.describeFailure({ failure })}` };
      }
    },
    appendProjectRule: ({ current, heading, rule }) => {
      try {
        return { kind: "prepared", content: bindings.appendRule({ current, heading, rule }) };
      } catch (failure) {
        return { kind: "failed", stage: "plan", applied: "none", reason: `appendUnderHeading failed on ${heading.slice(3)}: ${bindings.describeFailure({ failure })}` };
      }
    },
  };
}
export interface PracticesPromotionRepository {
  read: () => PracticesPromotionInputs | PracticesPromotionFailure;
  writeProject: (request: { content: string }) => { kind: "written" } | PracticesPromotionFailure;
  writeTeam: (request: { content: string }) => { kind: "written" } | PracticesPromotionFailure;
}

export type PracticesAffirmation = { kind: "affirmed"; affirmedAt: string } | PracticesPromotionFailure;
export type PracticesPromotionResult = (PracticesPromotionSummary & { kind: "promoted"; affirmedAt: string }) | PracticesPromotionFailure;

function ruleIdentity(request: { text: string }): string {
  return request.text.replace(/(?: \(affirmed \d{4}-\d{2}-\d{2}\))+$/, "");
}

function heldRules(request: { section: string }): string[] {
  return request.section.split("\n").map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("<!--") && !line.startsWith("#"))
    .map((line) => ruleIdentity({ text: line.replace(/^(?:[-*+]|\d+[.)])\s+/, "") }));
}

function additionsUnder(request: { heading: string; discoveredRules: string; projectMd: string; content: PracticesContentPort }): string[] {
  const held = heldRules({ section: request.content.section({ markdown: request.projectMd, heading: request.heading }) });
  const items = request.content.ruleItems({ section: request.content.section({ markdown: request.discoveredRules, heading: request.heading }) });
  const rules = items.map((text) => ruleIdentity({ text })).filter((rule) => rule !== "");
  return [...new Set(rules)].filter((rule) => !held.includes(rule));
}

export function practicesRulesToAdd(request: {
  discoveredRules: string; projectMd: string; content: PracticesContentPort;
}): PracticesRules {
  return {
    mandated: additionsUnder({ ...request, heading: "## Mandated" }),
    forbidden: additionsUnder({ ...request, heading: "## Forbidden" }),
  };
}

const TEAM_SECTIONS = ["## Way of Working", "## Walking Skeleton", "## Testing Posture", "## Deployment", "## Code Style"];
type TeamPlan = { kind: "planned"; content: string; sectionsWritten: string[] } | PracticesPromotionFailure;

function replacePracticeArea(request: { plan: TeamPlan; heading: string; draft: string; content: PracticesContentPort }): TeamPlan {
  if (request.plan.kind === "failed") return request.plan;
  const section = request.content.section({ markdown: request.draft, heading: request.heading });
  if (section === "") return request.plan;
  const prepared = request.content.replaceTeamSection({ current: request.plan.content, heading: request.heading, section });
  if (prepared.kind === "failed") return prepared;
  return { kind: "planned", content: prepared.content, sectionsWritten: [...request.plan.sectionsWritten, request.heading.slice(3)] };
}

function planTeamPractices(request: { draft: string; current: string; content: PracticesContentPort }): TeamPlan {
  return TEAM_SECTIONS.reduce<TeamPlan>((plan, heading) => replacePracticeArea({ ...request, plan, heading }),
    { kind: "planned", content: request.current, sectionsWritten: [] });
}

interface RuleAppend { heading: string; rule: string }
function appendRule(request: { prepared: PracticesContentResult; addition: RuleAppend; content: PracticesContentPort }): PracticesContentResult {
  if (request.prepared.kind === "failed") return request.prepared;
  return request.content.appendProjectRule({ current: request.prepared.content, ...request.addition });
}

export function planPracticesPromotion(request: {
  inputs: PracticesPromotionInputs; today: string; content: PracticesContentPort;
}): PracticesPromotionPlan | PracticesPromotionFailure {
  const team = planTeamPractices({ draft: request.inputs.teamPractices, current: request.inputs.team, content: request.content });
  if (team.kind === "failed") return team;
  const rules = practicesRulesToAdd({ discoveredRules: request.inputs.discoveredRules, projectMd: request.inputs.project, content: request.content });
  const additions = [
    ...rules.mandated.map((rule) => ({ heading: "## Mandated", rule: `- ${rule} (affirmed ${request.today})\n` })),
    ...rules.forbidden.map((rule) => ({ heading: "## Forbidden", rule: `- ${rule} (affirmed ${request.today})\n` })),
  ];
  const project = additions.reduce<PracticesContentResult>((prepared, addition) => appendRule({ prepared, addition, content: request.content }),
    { kind: "prepared", content: request.inputs.project });
  if (project.kind === "failed") return project;
  return { kind: "planned", team: team.content, project: project.content, sectionsWritten: team.sectionsWritten,
    rulesAppended: { mandated: rules.mandated.length, forbidden: rules.forbidden.length } };
}

export function promotePractices(request: {
  repository: PracticesPromotionRepository;
  content: PracticesContentPort;
  today: string;
  commitAffirmation: (summary: PracticesPromotionSummary) => PracticesAffirmation;
}): PracticesPromotionResult {
  const inputs = request.repository.read();
  if (inputs.kind === "failed") return inputs;
  const plan = planPracticesPromotion({ inputs, today: request.today, content: request.content });
  if (plan.kind === "failed") return plan;
  const projectWrite = request.repository.writeProject({ content: plan.project });
  if (projectWrite.kind === "failed") return projectWrite;
  const teamWrite = request.repository.writeTeam({ content: plan.team });
  if (teamWrite.kind === "failed") return teamWrite;
  const summary = { sectionsWritten: plan.sectionsWritten, rulesAppended: plan.rulesAppended };
  const affirmation = request.commitAffirmation(summary);
  if (affirmation.kind === "failed") return affirmation;
  return { kind: "promoted", ...summary, affirmedAt: affirmation.affirmedAt };
}

export type PracticesFileRead = { kind: "read"; content: string } | { kind: "unreadable"; detail: string };
export type PracticesFileWrite = { kind: "written" } | { kind: "unwritable"; detail: string };
export interface PracticesFilesPort {
  presence: (request: { path: string }) => "present" | "absent";
  read: (request: { path: string }) => PracticesFileRead;
  write: (request: { path: string; content: string }) => PracticesFileWrite;
}

export interface PracticesFileBindings {
  presence: PracticesFilesPort["presence"];
  readText: (request: { path: string }) => string;
  writeText: (request: { path: string; content: string }) => void;
  describeFailure: (request: { failure: unknown }) => string;
}

export function createPracticesFiles(bindings: PracticesFileBindings): PracticesFilesPort {
  return {
    presence: bindings.presence,
    read: ({ path }) => {
      try {
        return { kind: "read", content: bindings.readText({ path }) };
      } catch (failure) {
        return { kind: "unreadable", detail: bindings.describeFailure({ failure }) };
      }
    },
    write: ({ path, content }) => {
      try {
        bindings.writeText({ path, content });
        return { kind: "written" };
      } catch (failure) {
        return { kind: "unwritable", detail: bindings.describeFailure({ failure }) };
      }
    },
  };
}
export interface PracticesPromotionLocation {
  teamPracticesPath: string;
  discoveredRulesPath: string;
  teamPath: string;
  projectPath: string;
  draftDirectory: "same" | "different";
  contributions: () => { agent: string; path: string }[];
}

interface RepositoryRequest { location: PracticesPromotionLocation; files: PracticesFilesPort }
function contributionProblem(request: { path: string; agent: string; files: PracticesFilesPort }): string[] {
  const read = request.files.read({ path: request.path });
  if (read.kind === "unreadable") return [`${request.agent} (no contribution file)`];
  const firstLine = read.content.split("\n", 1)[0]?.trim() ?? "";
  if (firstLine !== `**Collaborator:** ${request.agent}`) return [`${request.agent} (missing identity-marker first line)`];
  return [];
}

type PairRead = { kind: "loaded"; first: string; second: string } | PracticesPromotionFailure;
function readPair(request: {
  first: string; second: string; firstLabel: string; secondLabel: string; group: string; files: PracticesFilesPort;
}): PairRead {
  if (request.files.presence({ path: request.first }) === "absent") return { kind: "failed", stage: "load", applied: "none", reason: `${request.firstLabel}${request.first}` };
  if (request.files.presence({ path: request.second }) === "absent") return { kind: "failed", stage: "load", applied: "none", reason: `${request.secondLabel}${request.second}` };
  const first = request.files.read({ path: request.first });
  if (first.kind === "unreadable") return { kind: "failed", stage: "load", applied: "none", reason: `could not read ${request.group}: ${first.detail}` };
  const second = request.files.read({ path: request.second });
  if (second.kind === "unreadable") return { kind: "failed", stage: "load", applied: "none", reason: `could not read ${request.group}: ${second.detail}` };
  return { kind: "loaded", first: first.content, second: second.content };
}

function readPromotionInputs(request: RepositoryRequest): PracticesPromotionInputs | PracticesPromotionFailure {
  const { location, files } = request;
  if (location.draftDirectory === "different") return { kind: "failed", stage: "evidence", applied: "none", reason: "team-practices and discovered-rules drafts must share one stage directory" };
  const missing = location.contributions().flatMap((contribution) => contributionProblem({ ...contribution, files }));
  if (missing.length > 0) return { kind: "failed", stage: "evidence", applied: "none", reason: "ensemble evidence is incomplete: " + missing.join("; ") };
  const drafts = readPair({ first: location.teamPracticesPath, second: location.discoveredRulesPath, group: "drafts", files,
    firstLabel: "team-practices draft not found: ", secondLabel: "discovered-rules draft not found: " });
  if (drafts.kind === "failed") return drafts;
  const targets = readPair({ first: location.teamPath, second: location.projectPath, group: "targets", files,
    firstLabel: "team.md not found at ", secondLabel: "project.md not found at " });
  if (targets.kind === "failed") return targets;
  return { kind: "loaded", teamPractices: drafts.first, discoveredRules: drafts.second, team: targets.first, project: targets.second };
}

function writeProject(request: { path: string; content: string; files: PracticesFilesPort }): { kind: "written" } | PracticesPromotionFailure {
  const written = request.files.write({ path: request.path, content: request.content });
  if (written.kind === "unwritable") return { kind: "failed", stage: "project-write", applied: "none", reason: `writing project.md failed: ${written.detail}` };
  return written;
}

function writeTeam(request: { path: string; content: string; files: PracticesFilesPort }): { kind: "written" } | PracticesPromotionFailure {
  const written = request.files.write({ path: request.path, content: request.content });
  if (written.kind === "unwritable") return { kind: "failed", stage: "team-write", applied: "project", reason: `writing team.md failed AFTER project.md was written: ${written.detail}` };
  return written;
}

export function createPracticesPromotionRepository(request: RepositoryRequest): PracticesPromotionRepository {
  return {
    read: () => readPromotionInputs(request),
    writeProject: ({ content }) => writeProject({ path: request.location.projectPath, content, files: request.files }),
    writeTeam: ({ content }) => writeTeam({ path: request.location.teamPath, content, files: request.files }),
  };
}
