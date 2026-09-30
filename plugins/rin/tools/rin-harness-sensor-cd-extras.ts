import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";

type Finding = {
  rule: string;
  line: number;
  snippet: string;
};

type Result = {
  pass: boolean;
  findingsCount: number;
  findings: Finding[];
  scanned: string;
};

type Flags = {
  stage?: string;
  filePath?: string;
  outputPath?: string;
};

type SourceLine = {
  text: string;
  number: number;
};

type SwitchFold = {
  depth: number;
  findings: readonly Finding[];
};

const SNIPPET_MAX_LENGTH = 80;

const SWITCH_OPEN = /\bswitch\s*\(/g;
const CLOSING_BRACE = /\}/g;
const DEFAULT_ARM = /(^|[^.\w])default\s*:/;
const FOR_OF = /\bfor\s*(?:await\s*)?\(\s*(?:const|let|var)?[^;()]*\bof\b/;
const COUNTED_FOR = /\bfor\s*\([^)]*;[^)]*;[^)]*\)/;
const WHILE_LOOP = /\bwhile\s*\(/;
const RETURN_TYPE_TYPEOF = /\bReturnType\s*<\s*typeof\b/;
const SCANNABLE_SOURCE = /\.tsx?$/;

const FLAG_KEYS: Readonly<Record<string, keyof Flags>> = {
  "--stage": "stage",
  "--file-path": "filePath",
  "--output-path": "outputPath",
};

const parseFlags = (argv: readonly string[]): Flags => {
  const entries = argv.flatMap((token, index) => {
    const key = FLAG_KEYS[token];
    return key ? [[key, argv[index + 1]] as const] : [];
  });
  return Object.fromEntries(entries);
};

const trimSnippet = (raw: string): string => {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  return collapsed.length > SNIPPET_MAX_LENGTH
    ? `${collapsed.slice(0, SNIPPET_MAX_LENGTH)}…`
    : collapsed;
};

const isIgnorable = (text: string): boolean => {
  const trimmed = text.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*")
  );
};

const countMatches = (params: { text: string; pattern: RegExp }): number =>
  (params.text.match(params.pattern) ?? []).length;

const findingFor = (params: {
  matched: boolean;
  rule: string;
  line: SourceLine;
}): Finding | undefined =>
  params.matched
    ? {
        rule: params.rule,
        line: params.line.number,
        snippet: trimSnippet(params.line.text),
      }
    : undefined;

const forOfFinding = (line: SourceLine): Finding | undefined =>
  findingFor({
    matched: FOR_OF.test(line.text),
    rule: "CD-15 (no `for…of` — use map/reduce/flatMap/Array.from)",
    line,
  });

const countedForFinding = (line: SourceLine): Finding | undefined =>
  findingFor({
    matched: COUNTED_FOR.test(line.text),
    rule: "CD-16 (no counted `for` loop — use Array.from({ length }, mapper))",
    line,
  });

const whileLoopFinding = (line: SourceLine): Finding | undefined =>
  findingFor({
    matched: WHILE_LOOP.test(line.text),
    rule: "CD-15 (imperative `while` loop — permitted only as async stream drain at a CD-15 authorised location)",
    line,
  });

const returnTypeTypeofFinding = (line: SourceLine): Finding | undefined =>
  findingFor({
    matched: RETURN_TYPE_TYPEOF.test(line.text),
    rule: "CD-7a (do not derive an own type from a factory via ReturnType over typeof — export and use the named type)",
    line,
  });

const perLineFindings = (line: SourceLine): Finding[] =>
  [
    forOfFinding(line),
    countedForFinding(line),
    whileLoopFinding(line),
    returnTypeTypeofFinding(line),
  ].flatMap((finding) => (finding ? [finding] : []));

const foldSwitch = (accumulated: SwitchFold, line: SourceLine): SwitchFold => {
  const opens = countMatches({ text: line.text, pattern: SWITCH_OPEN });
  const closes = countMatches({ text: line.text, pattern: CLOSING_BRACE });
  const insideSwitch = accumulated.depth + opens > 0;
  const finding = findingFor({
    matched: insideSwitch && DEFAULT_ARM.test(line.text),
    rule: "CD-8 (no `default:` on a closed discriminated union — exhaustiveness is the type system's job)",
    line,
  });
  return {
    depth: Math.max(0, accumulated.depth + opens - closes),
    findings: finding
      ? [...accumulated.findings, finding]
      : accumulated.findings,
  };
};

const switchFindings = (lines: readonly SourceLine[]): readonly Finding[] =>
  lines.reduce<SwitchFold>(foldSwitch, { depth: 0, findings: [] }).findings;

const auditSource = (source: string): Finding[] => {
  const lines: SourceLine[] = source
    .split(/\r?\n/)
    .map((text, index) => ({ text, number: index + 1 }))
    .filter((line) => !isIgnorable(line.text));
  return [...lines.flatMap(perLineFindings), ...switchFindings(lines)].sort(
    (left, right) => left.line - right.line,
  );
};

const UPSTREAM_FINDINGS_COUNT_KEY = "findings_count";

const emit = (result: Result): never => {
  const wire: Record<string, unknown> = {
    pass: result.pass,
    [UPSTREAM_FINDINGS_COUNT_KEY]: result.findingsCount,
    findings: result.findings,
    scanned: result.scanned,
  };
  process.stdout.write(`${JSON.stringify(wire)}\n`);
  process.exit(0);
};

const main = (): void => {
  const flags = parseFlags(process.argv.slice(2));
  const target = flags.filePath ?? flags.outputPath;
  if (!target || !existsSync(target) || !SCANNABLE_SOURCE.test(target)) {
    emit({
      pass: true,
      findingsCount: 0,
      findings: [],
      scanned: target ? basename(target) : "(none)",
    });
  }

  const resolved = target as string;
  const findings = auditSource(readFileSync(resolved, "utf-8"));
  emit({
    pass: findings.length === 0,
    findingsCount: findings.length,
    findings,
    scanned: basename(resolved),
  });
};

const invokedDirectly =
  process.argv[1]?.endsWith("rin-harness-sensor-cd-extras.ts") ?? false;

if (invokedDirectly) main();

export type { Finding };
export { auditSource };
