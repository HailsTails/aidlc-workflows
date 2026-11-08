import { z } from "zod";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { MethodSourceLocation } from "../domain/method-source.ts";
import type { MethodRefusal } from "../domain/refusals.ts";

type Markdown = { readonly header: string; readonly body: string };

const split = (raw: string): Markdown => {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match) return { header: "", body: normalized };
  return { header: match[1] ?? "", body: normalized.slice(match[0].length) };
};

const stringScalar = (authored: string): string => {
  if (/^["']/.test(authored)) return authored;
  if (/^[>|][+-]?$/.test(authored)) return authored;
  return JSON.stringify(authored);
};

const protectStrings = (header: string, keys: readonly string[]): string =>
  header.split("\n").map((line) => {
    const field = /^([a-zA-Z_][a-zA-Z0-9_]*):[ \t]*(.*)$/.exec(line);
    if (!field || !keys.includes(field[1] ?? "")) return line;
    return `${field[1]}: ${stringScalar(field[2] ?? "")}`;
  }).join("\n");

const parseHeader = (header: string, strings: readonly string[]): unknown =>
  header ? Bun.YAML.parse(protectStrings(header, strings)) : {};

const reservedIssues = (request: {
  readonly parsed: unknown; readonly source: MethodSourceLocation;
  readonly reserved: Readonly<Record<string, string>>;
}): readonly MethodRefusal[] => {
  const fields = z.record(z.string(), z.unknown()).safeParse(request.parsed);
  if (!fields.success) return [];
  return Object.keys(fields.data).flatMap((key) => {
    const reservedFor = request.reserved[key];
    return reservedFor ? [{ kind: "reserved-key" as const, location: { kind: "method-source", ...request.source },
      key, reservedFor }] : [];
  });
};

export const decodeMarkdown = <Value>(request: {
  readonly source: MethodSourceLocation;
  readonly raw: string;
  readonly schema: z.ZodType<Value>;
  readonly strings: readonly string[];
  readonly header?: "required" | "optional";
  readonly reserved?: Readonly<Record<string, string>>;
}): Result<{ readonly file: Value; readonly body: string }, readonly MethodRefusal[]> => {
  const markdown = split(request.raw);
  if (!markdown.header && request.header !== "optional") {
    return refused([{ kind: "invalid-file", location: { kind: "method-source", ...request.source },
      issues: ["Missing YAML frontmatter"] }]);
  }
  try {
    const parsed = parseHeader(markdown.header, request.strings);

    const reserved = reservedIssues({ parsed, source: request.source,
      reserved: request.reserved ?? {} });
    if (reserved.length) return refused(reserved);
    const authored = request.schema.safeParse(parsed);
    if (!authored.success) {
      const issues = authored.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      return refused([{ kind: "invalid-file", location: { kind: "method-source", ...request.source }, issues }]);
    }
    return accepted({ file: authored.data, body: markdown.body });
  } catch (error) {
    return refused([{ kind: "invalid-file", location: { kind: "method-source", ...request.source },
      issues: [error instanceof Error ? error.message : String(error)] }]);
  }
};

export const translated = <Value>(source: MethodSourceLocation, translate: () => Value):
  Result<Value, readonly MethodRefusal[]> => {
  try {
    return accepted(translate());
  } catch (error) {
    return refused([{ kind: "invalid-file", location: { kind: "method-source", ...source },
      issues: [error instanceof Error ? error.message : String(error)] }]);
  }
};

export const authoredValue = <Value>(admission: Result<Value, unknown>): Value => {
  if (!admission.ok) throw new Error(`Invalid authored value: ${JSON.stringify(admission.refusal)}`);
  return admission.value;
};
