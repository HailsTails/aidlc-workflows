import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  AuditFinding,
  AuditReport,
  Command,
  CommandRunner,
  DisciplineAudit,
  Loaded,
} from "../application/ports.ts";

export const INSTALL_LINK = ".cache/discipline-core";

export type DisciplineCoreLocation = {
  readonly root: string;
  readonly install: string;
  readonly pin: string | undefined;
  readonly runner: CommandRunner;
};

const INFORMATIONAL_SECTIONS = ["excluded", "exempted"];

const SECTION_HEADER = /^([A-Za-z]+) \((\d+)\)$/;

const VERDICT_LINE = /^verdict: (pass|fail)$/;

const FINDING_LINE = /^(\S+) \S+ (\S+) (.*)$/;

type Sections = Readonly<Record<string, readonly string[]>>;

const sectionsOf = (output: string): Sections => {
  const sections: Record<string, string[]> = {};
  let current: string[] = [];
  for (const line of output.split(/\r?\n/)) {
    const header = SECTION_HEADER.exec(line);
    if (header?.[1] !== undefined) {
      current = [];
      sections[header[1]] = current;
    } else if (line.trim() !== "" && !VERDICT_LINE.test(line)) {
      current.push(line);
    }
  }
  return sections;
};

const auditFindingOf = (line: string): AuditFinding => {
  const parsed = FINDING_LINE.exec(line);
  return {
    clause: parsed?.[1] ?? "unknown",
    location: parsed?.[2] ?? line,
    snippet: (parsed?.[3] ?? "").slice(0, 120),
  };
};

const reportOf = (output: string): AuditReport => {
  const verdict = output
    .split(/\r?\n/)
    .map((line) => VERDICT_LINE.exec(line.trim())?.[1])
    .find((found) => found === "pass" || found === "fail");
  if (verdict === undefined) {
    return {
      kind: "failed",
      problem: output.trim().split(/\r?\n/).at(-1) ?? "discipline-core printed no verdict",
      fix: "Read the load failure; it names the input that could not be loaded.",
    };
  }
  const sections = sectionsOf(output);
  const problems = Object.entries(sections)
    .filter(([name]) => name !== "findings" && !INFORMATIONAL_SECTIONS.includes(name))
    .flatMap(([name, lines]) => lines.map((line) => `${name}: ${line}`));
  const findings = (sections["findings"] ?? []).map(auditFindingOf);
  return { kind: "ran", verdict, findings, problems };
};

const MISSING_INSTALL_FIX =
  "Check out Helen's fork main beside the main checkout (git worktree add --detach " +
  "<parent>/aidlc-discipline-core-main origin/main), run bun install --production " +
  "--no-save in its plugins/discipline-core, or point AIDLC_DISCIPLINE_CORE at an install.";

const installedCommit = (install: string): string =>
  Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: install, stdout: "pipe", stderr: "pipe" })
    .stdout.toString()
    .trim();

const pinnedInstall = (location: DisciplineCoreLocation): Loaded<string> => {
  if (!existsSync(join(location.install, "core/check/check-command.ts"))) {
    return {
      ok: false,
      problem: `no discipline-core install at ${location.install}`,
      fix: MISSING_INSTALL_FIX,
    };
  }
  const installed = installedCommit(location.install);
  return location.pin !== undefined && installed === location.pin
    ? { ok: true, value: location.install }
    : {
        ok: false,
        problem:
          `discipline-core at ${location.install} is at ${installed || "no git commit"}, ` +
          `the gate pins ${location.pin ?? "nothing"} (lint/discipline-core-pin.txt)`,
        fix:
          "Check the fork out at the pinned commit (git checkout --detach <pin> in that " +
          "checkout) and run bun install --production --no-save in plugins/discipline-core.",
      };
};

const linked = (location: DisciplineCoreLocation): Loaded<string> => {
  const link = join(location.root, INSTALL_LINK);
  const install = pinnedInstall(location);
  if (!install.ok) {
    return install;
  }
  if (!existsSync(link)) {
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(location.install, link, "junction");
  }
  return { ok: true, value: link };
};

const nodeCommand = (command: string): Command => ({
  label: `discipline-core ${command}`,
  argv: [
    "node",
    "--preserve-symlinks",
    "--preserve-symlinks-main",
    `${INSTALL_LINK}/core/check/${command}.ts`,
    "--repo",
    ".",
  ],
});

export const disciplineCore = (location: DisciplineCoreLocation): DisciplineAudit => ({
  project: () => {
    const link = linked(location);
    if (!link.ok) {
      return link;
    }
    const result = location.runner.capture(nodeCommand("project-command"));
    return result.exitCode === 0
      ? { ok: true, value: result.output }
      : {
          ok: false,
          problem: `project-command failed: ${result.output.trim()}`,
          fix: "Fix disciplines.json; the projection is written from it.",
        };
  },
  run: () => {
    const link = linked(location);
    return link.ok
      ? reportOf(location.runner.capture(nodeCommand("check-command")).output)
      : { kind: "failed", problem: link.problem, fix: link.fix };
  },
});
