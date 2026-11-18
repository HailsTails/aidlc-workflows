import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";

type SourceLine = { readonly text: string; readonly start: number; readonly end: number };
type ManagedSlot = { readonly effect: "allow" | "ask"; readonly start: number; readonly end: number };
type SlotReading = Result<readonly ManagedSlot[], ProjectionRefusal>;

const invalidTemplate = (reason: string): Result<never, ProjectionRefusal> => refused({
  kind: "render-failed", concept: "agent", name: "agents/aidlc-aidlc.md",
  reason: `The conductor permission template ${reason}.`,
});

const sourceLines = (source: string): readonly SourceLine[] => [...source.matchAll(/[^\n]*(?:\n|$)/g)]
  .filter((line) => line[0].length > 0)
  .map((line) => ({ text: line[0].replace(/\r?\n$/, ""), start: line.index,
    end: line.index + line[0].length }));
const significant = (line: SourceLine) => !/^\s*(?:#.*)?$/.test(line.text);

const rulesLines = (lines: readonly SourceLine[]): Result<readonly SourceLine[], ProjectionRefusal> => {
  if (lines[0]?.text !== "---") return invalidTemplate("requires opening frontmatter");
  const close = lines.findIndex((line, index) => index > 0 && line.text === "---");
  if (close < 0) return invalidTemplate("requires closed frontmatter");
  const frontmatter = lines.slice(1, close);
  const permissions = frontmatter.flatMap((line, index) => /^(?:permissions|"permissions"|'permissions'):/.test(line.text)
    ? [index] : []);
  const [permission] = permissions;
  if (permission === undefined || permissions.length !== 1
    || !/^permissions:\s*(?:#.*)?$/.test(frontmatter[permission]?.text ?? "")) {
    return invalidTemplate("requires exactly one permissions mapping");
  }
  const end = frontmatter.findIndex((line, index) => index > permission
    && significant(line) && /^\S/.test(line.text));
  const section = frontmatter.slice(permission + 1, end < 0 ? undefined : end);
  const rules = section.flatMap((line, index) => /^ {2}(?:rules|"rules"|'rules'):/.test(line.text)
    ? [index] : []);
  const [rule] = rules;
  if (rule === undefined || rules.length !== 1
    || !/^ {2}rules:\s*(?:#.*)?$/.test(section[rule]?.text ?? "")) {
    return invalidTemplate("requires exactly one rules sequence");
  }
  const rulesEnd = section.findIndex((line, index) => index > rule && significant(line)
    && /^ {0,2}\S/.test(line.text));
  return accepted(section.slice(rule + 1, rulesEnd < 0 ? undefined : rulesEnd));
};

const managedMatch = (request: {
  readonly lines: readonly SourceLine[]; readonly effect: "allow" | "ask";
}): SlotReading => {
  const keys = request.lines.flatMap((line, index) => {
    const key = line.text.replace(/^ {4}- /, "      ").match(/^ {6}([a-zA-Z]+):\s*(.*?)\s*$/);
    return key ? [{ name: key[1], value: key[2], index }] : [];
  });
  const matches = keys.filter((key) => key.name === "match");
  const [match] = matches;
  const unsupported = request.lines.some((line) => {
    const text = line.text.replace(/^ {4}- /, "      ");
    return /^ {6}\S/.test(text) && !/^ {6}(?:capability|effect|match):/.test(text)
      && !/^ {6}#/.test(text);
  });
  if (!match || matches.length !== 1 || !/^(?:#.*)?$/.test(match.value ?? "")
    || unsupported || keys.some((key) => !["capability", "effect", "match"].includes(key.name ?? ""))) {
    return invalidTemplate("requires one block match list in each managed shell rule");
  }
  const tail = request.lines.slice(match.index + 1);
  const first = tail.findIndex(significant);
  if (first < 0) return invalidTemplate("requires nonempty managed match lists");
  const following = tail.slice(first);
  const stop = following.findIndex((line) => !/^ {8}- \S/.test(line.text));
  const patterns = following.slice(0, stop < 0 ? undefined : stop);
  const after = following.slice(patterns.length);
  const start = patterns[0]?.start;
  const end = patterns.at(-1)?.end;
  if (start === undefined || end === undefined
    || after.some((line) => significant(line) && !/^ {6}\S/.test(line.text))) {
    return invalidTemplate("requires contiguous block entries in managed match lists");
  }
  return accepted([{ effect: request.effect, start, end }]);
};

const ruleSlot = (lines: readonly SourceLine[]): SlotReading => {
  const identityLines = lines.filter((line) => /^ {6}(?:["']?(?:capability|effect)["']?):/
    .test(line.text.replace(/^ {4}- /, "      ")));
  const fields = lines.flatMap((line) => {
    const field = line.text.replace(/^ {4}- /, "      ")
      .match(/^ {6}(capability|effect):\s*([a-z_-]+)\s*(?:#.*)?$/);
    return field ? [{ key: field[1], value: field[2] }] : [];
  });
  const capabilities = fields.filter((field) => field.key === "capability");
  const effects = fields.filter((field) => field.key === "effect");
  if (capabilities.length !== 1 || effects.length !== 1 || fields.length !== identityLines.length) {
    return invalidTemplate("requires one plain capability and effect in each rule");
  }
  const effect = effects[0]?.value;
  return capabilities[0]?.value === "shell" && (effect === "allow" || effect === "ask")
    ? managedMatch({ lines, effect }) : accepted([]);
};

const admittedSlots = (lines: readonly SourceLine[]): SlotReading => {
  const entries = lines.flatMap((line, index) => /^ {4}- /.test(line.text) ? [index] : []);
  const first = entries[0];
  if (first === undefined || lines.slice(0, first).some(significant)) {
    return invalidTemplate("requires a block rules sequence");
  }
  const readings = entries.map((start, index) => ruleSlot(lines.slice(start, entries[index + 1])));
  const failed = readings.find((reading) => !reading.ok);
  if (failed && !failed.ok) return failed;
  const slots = readings.flatMap((reading) => reading.ok ? reading.value : []);
  return slots.filter((slot) => slot.effect === "allow").length === 1
    && slots.filter((slot) => slot.effect === "ask").length === 1
    ? accepted(slots) : invalidTemplate("requires exactly one shell allow and one shell ask rule");
};

export const renderConductorPermissions = (request: {
  readonly source: string;
  readonly shell: { readonly allow: readonly string[]; readonly ask: readonly string[] };
}): Result<string, ProjectionRefusal> => {
  const rules = rulesLines(sourceLines(request.source));
  if (!rules.ok) return rules;
  const slots = admittedSlots(rules.value);
  if (!slots.ok) return slots;
  const newline = request.source.startsWith("---\r\n") ? "\r\n" : "\n";
  return accepted(slots.value.toSorted((left, right) => right.start - left.start).reduce((source, slot) =>
    source.slice(0, slot.start) + request.shell[slot.effect].slice(3).join(newline) + newline
      + source.slice(slot.end), request.source));
};
