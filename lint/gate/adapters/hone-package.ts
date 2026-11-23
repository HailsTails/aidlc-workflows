import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  AuditFinding,
  AuditReport,
  Command,
  CommandRunner,
  DisciplineAudit,
  Loaded,
  Toolchain,
} from "../application/ports.ts";

export const HONE_ENTRY = "node_modules/@hailstails/hone/src/hone.js";

export type HonePackageLocation = {
  readonly root: string;
  readonly runner: CommandRunner;
};

const INFORMATIONAL_SECTIONS = [
  "excluded",
  "editions",
  "answered",
  "carried",
  "readFirst",
  "symptoms",
];

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
      problem: output.trim().split(/\r?\n/).at(-1) ?? "hone printed no verdict",
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
  "Run bun install; the package is a devDependency pinned in package.json.";

const nodeCommand = (arguments_: readonly string[]): Command => ({
  label: `hone ${arguments_[0] ?? ""}`.trim(),
  argv: ["node", HONE_ENTRY, ...arguments_, "--repo", "."],
});

const installed = (location: HonePackageLocation): Loaded<string> =>
  existsSync(join(location.root, HONE_ENTRY))
    ? { ok: true, value: join(location.root, HONE_ENTRY) }
    : {
        ok: false,
        problem: `no @hailstails/hone install at ${HONE_ENTRY}`,
        fix: MISSING_INSTALL_FIX,
      };

export const honePackage = (location: HonePackageLocation): DisciplineAudit & Toolchain => ({
  ready: () => installed(location),
  project: () => {
    const entry = installed(location);
    if (!entry.ok) {
      return entry;
    }
    const result = location.runner.capture(nodeCommand(["project"]));
    return result.exitCode === 0
      ? { ok: true, value: result.output }
      : {
          ok: false,
          problem: `hone project failed: ${result.output.trim()}`,
          fix: "Fix hone.config.json; the projection is written from it.",
        };
  },
  run: (base) => {
    const entry = installed(location);
    return entry.ok
      ? reportOf(location.runner.capture(nodeCommand(["check", "--base-revision", base])).output)
      : { kind: "failed", problem: entry.problem, fix: entry.fix };
  },
});
