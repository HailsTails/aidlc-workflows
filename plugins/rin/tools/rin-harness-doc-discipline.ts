import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { CHAIN_LABEL } from "./rin-harness-why-chain.ts";

const FACT_ROW = /^\|\s*\*\*([A-Z]+-\d+)\*\*\s*\|/;
const KEY_REFERENCE = /\b([A-Z]+-\d+)\b/g;

const RESERVED_PREFIXES = new Set(["DD", "CD", "IF", "G3", "FR", "AC", "NFR"]);

const SELF_NUMBERED_HEADINGS: Readonly<Record<string, RegExp>> = {
  "rin-framing-questions.md": /^#{2,6}\s+([QD]-\d+)\b/gm,
  "rin-plan-review-questions.md": /^#{2,6}\s+(D-\d+)\b/gm,
};

const isSelfNumbered = ({
  key,
  document,
}: {
  readonly key: string;
  readonly document: ProseDocument;
}): boolean => {
  const heading = SELF_NUMBERED_HEADINGS[document.name];
  return heading === undefined
    ? false
    : [...document.body.matchAll(heading)].some((match) => match[1] === key);
};

const isReservedKey = ({ key }: { readonly key: string }): boolean =>
  RESERVED_PREFIXES.has(key.split("-")[0] ?? "");
const FENCE = /^\s*```/;
const TABLE_ROW = /^\s*\|/;

const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
const RECORD_SLUG = /\b\d{6}-[a-z0-9-]+/g;
const PR_REFERENCE = /#\d+|https?:\/\/\S+/g;

const RECEIPT_TOKEN = /\breview:[0-9a-f]{32}\b/g;

const ALGORITHM_NAME = /\b(?:sha|md|blake|crc|base|utf)-?\d+\b/gi;
const SECTION_REFERENCE = /§\s*\d+[a-z]?/g;
const GATE_REFERENCE = /\b[Gg]ate\s+\d+/g;
const ALLOWED_BARE = [/^20\d{2}$/, /^\d{1,2}$/];

const FACTS_FILENAME = "facts.md";

type DocRule = "DD-1" | "DD-2" | "DD-3" | "DD-7";

type Finding = {
  readonly rule: DocRule;
  readonly artefact: string;
  readonly line: number;
  readonly subject: string;
  readonly remedy: string;
};

type KeyedLine = { readonly key: string; readonly line: number };

type ProseDocument = { readonly name: string; readonly body: string };

type RecordSources = {
  readonly factsBody: string;
  readonly proseDocuments: readonly ProseDocument[];
};

type StageNode = {
  readonly produces?: readonly string[];
};

const collectDefinedKeys = ({
  factsBody,
}: {
  readonly factsBody: string;
}): readonly KeyedLine[] =>
  factsBody.split("\n").flatMap((line, index) => {
    const match = line.match(FACT_ROW);
    return match?.[1] === undefined ? [] : [{ key: match[1], line: index + 1 }];
  });

const collectReferences = ({
  body,
}: {
  readonly body: string;
}): readonly KeyedLine[] => {
  let fenced = false;
  return body.split("\n").flatMap((line, index) => {
    if (FENCE.test(line)) {
      fenced = !fenced;
      return [];
    }
    if (fenced) {
      return [];
    }
    return [...line.matchAll(KEY_REFERENCE)].flatMap((match) =>
      match[1] === undefined || isReservedKey({ key: match[1] })
        ? []
        : [{ key: match[1], line: index + 1 }],
    );
  });
};

const findStructuralFindings = ({
  defined,
}: {
  readonly defined: readonly KeyedLine[];
}): readonly Finding[] => {
  const seen = new Map<string, number>();
  const lastOrdinal = new Map<string, number>();

  return defined.flatMap<Finding>(({ key, line }) => {
    const previous = seen.get(key);
    seen.set(key, line);
    if (previous !== undefined) {
      return [
        {
          rule: "DD-3" as const,
          artefact: FACTS_FILENAME,
          line,
          subject: key,
          remedy: `${key} already has a row at line ${previous}. Delete this row and correct the original in place — a claim has one row across the whole record.`,
        },
      ];
    }
    const [prefix, ordinalText] = key.split("-");
    const ordinal = Number(ordinalText);
    const previousOrdinal =
      prefix === undefined ? undefined : lastOrdinal.get(prefix);
    if (prefix !== undefined) {
      lastOrdinal.set(prefix, ordinal);
    }
    return previousOrdinal !== undefined && ordinal < previousOrdinal
      ? [
          {
            rule: "DD-1" as const,
            artefact: FACTS_FILENAME,
            line,
            subject: key,
            remedy: `${key} follows ${prefix}-${previousOrdinal}. Move this row so ${prefix}- keys ascend, or renumber it.`,
          },
        ]
      : [];
  });
};

const findDanglingFindings = ({
  definedKeys,
  proseDocuments,
}: {
  readonly definedKeys: ReadonlySet<string>;
  readonly proseDocuments: readonly ProseDocument[];
}): readonly Finding[] =>
  proseDocuments.flatMap((document) =>
    collectReferences({ body: document.body }).flatMap(({ key, line }) =>
      definedKeys.has(key) || isSelfNumbered({ key, document })
        ? []
        : [
            {
              rule: "DD-1" as const,
              artefact: document.name,
              line,
              subject: key,
              remedy: `${key} is referenced but has no row in ${FACTS_FILENAME}. Add a row for ${key} with its value and re-derive command, or correct the reference.`,
            },
          ],
    ),
  );

const findOrphanFindings = ({
  defined,
  proseDocuments,
}: {
  readonly defined: readonly KeyedLine[];
  readonly proseDocuments: readonly ProseDocument[];
}): readonly Finding[] => {
  const referencedKeys = new Set(
    proseDocuments.flatMap((document) =>
      collectReferences({ body: document.body }).map((entry) => entry.key),
    ),
  );
  return defined.flatMap(({ key, line }) =>
    referencedKeys.has(key)
      ? []
      : [
          {
            rule: "DD-3" as const,
            artefact: FACTS_FILENAME,
            line,
            subject: key,
            remedy: `${key} is defined but referenced by no official artefact in this record. Reference it where it is used, or delete the row.`,
          },
        ],
  );
};

const findKeyIntegrityFindings = ({
  factsBody,
  proseDocuments,
}: RecordSources): readonly Finding[] => {
  const defined = collectDefinedKeys({ factsBody });
  return [
    ...findStructuralFindings({ defined }),
    ...findDanglingFindings({
      definedKeys: new Set(defined.map((entry) => entry.key)),
      proseDocuments,
    }),
    ...findOrphanFindings({ defined, proseDocuments }),
  ];
};

const findBareFigureFindings = ({
  proseDocuments,
}: {
  readonly proseDocuments: readonly ProseDocument[];
}): readonly Finding[] =>
  proseDocuments.flatMap((document) => {
    let fenced = false;
    return document.body.split("\n").flatMap((line, index) => {
      if (FENCE.test(line)) {
        fenced = !fenced;
        return [];
      }
      if (fenced || TABLE_ROW.test(line)) {
        return [];
      }
      const scrubbed = line
        .replace(/`[^`]*`/g, " ")
        .replace(RECEIPT_TOKEN, " ")
        .replace(ALGORITHM_NAME, " ")
        .replace(ISO_DATE, " ")
        .replace(RECORD_SLUG, " ")
        .replace(PR_REFERENCE, " ")
        .replace(SECTION_REFERENCE, " ")
        .replace(GATE_REFERENCE, " ")
        .replace(KEY_REFERENCE, " ");
      return (scrubbed.match(/\d[\d,.]*\d|\d/g) ?? [])
        .filter((token) => !ALLOWED_BARE.some((pattern) => pattern.test(token)))
        .map((token) => ({
          rule: "DD-2" as const,
          artefact: document.name,
          line: index + 1,
          subject: token,
          remedy: `${document.name}:${index + 1} states the figure ${token} inline. Move it into a ${FACTS_FILENAME} row and reference that key here instead.`,
        }));
    });
  });

const EXCEPTION_CLAIM =
  /\b(?:deferred|defer(?:ring)?\s+(?:this|that|it)|(?:is|are|was|were|stays?|remains?|left|treated\s+as|classified\s+as)\s+(?:\w+\s+){0,2}?(?:out\s+of\s+scope|inherited\s+debt)|carved\s+out|grandfathered)\b/i;

const MENTION_SPANS = [/`[^`]*`/g, /"[^"]*"/g, /\*"[^"]*"\*/g] as const;

const withoutMentions = (text: string): string =>
  MENTION_SPANS.reduce((stripped, span) => stripped.replace(span, " "), text);

const NEGATED_CLAIM =
  /\b(?:never|not|nothing|none|no|cannot|can't|must\s+not|neither|nor|without)\b[^.;]{0,40}?\b(?:deferred|defer(?:ring)?|out\s+of\s+scope|inherited\s+debt|carved\s+out|grandfathered)\b/i;

const CHAIN_SHAPE = /(?:^|[\s|>])5\.\s*\S|\broot cause\b/i;
const SECTION_HEADING = /^#{1,6}\s/;

const SUBJECT_EXCERPT_LENGTH = 120;

type Section = {
  readonly heading: string;
  readonly startLine: number;
  readonly lines: readonly { readonly text: string; readonly line: number }[];
};

const sectionsOf = ({
  body,
}: {
  readonly body: string;
}): readonly Section[] => {
  const sections: Section[] = [];
  let current: {
    heading: string;
    startLine: number;
    lines: { text: string; line: number }[];
  } = { heading: "(preamble)", startLine: 1, lines: [] };
  let fenced = false;

  body.split("\n").forEach((text, index) => {
    const line = index + 1;
    if (FENCE.test(text)) {
      fenced = !fenced;
      return;
    }
    if (!fenced && SECTION_HEADING.test(text)) {
      sections.push(current);
      current = { heading: text.trim(), startLine: line, lines: [] };
      return;
    }
    if (!fenced) {
      current.lines.push({ text, line });
    }
  });
  sections.push(current);
  return sections;
};

const findUnchainedExceptionFindings = ({
  proseDocuments,
}: {
  readonly proseDocuments: readonly ProseDocument[];
}): readonly Finding[] =>
  proseDocuments.flatMap((document) =>
    sectionsOf({ body: document.body }).flatMap((section) => {
      const sectionText = section.lines.map((entry) => entry.text).join("\n");
      if (
        CHAIN_LABEL.test(sectionText) ||
        CHAIN_LABEL.test(section.heading) ||
        CHAIN_SHAPE.test(sectionText)
      ) {
        return [];
      }
      const claim = section.lines.find(
        (entry) =>
          !TABLE_ROW.test(entry.text) &&
          EXCEPTION_CLAIM.test(withoutMentions(entry.text)) &&
          !NEGATED_CLAIM.test(withoutMentions(entry.text)),
      );
      return claim === undefined
        ? []
        : [
            {
              rule: "DD-7" as const,
              artefact: document.name,
              line: claim.line,
              subject: claim.text.trim().slice(0, SUBJECT_EXCERPT_LENGTH),
              remedy: `${document.name}:${claim.line} claims an exception with no Five Whys chain in its section. Add the chain beside the claim — five answered whys, each citing evidence, ending at a root cause and its owner (project.md § R7).`,
            },
          ];
    }),
  );

const officialArtefactStems = ({
  stageGraphPath,
}: {
  readonly stageGraphPath: string;
}): ReadonlySet<string> | undefined => {
  if (!existsSync(stageGraphPath)) {
    return undefined;
  }
  const parsed: unknown = JSON.parse(readFileSync(stageGraphPath, "utf8"));
  const nodes = Array.isArray(parsed)
    ? (parsed as readonly StageNode[])
    : ((parsed as { readonly stages?: readonly StageNode[] }).stages ?? []);
  return new Set(nodes.flatMap((node) => node.produces ?? []));
};

const officialProseIn = ({
  recordDir,
  stems,
}: {
  readonly recordDir: string;
  readonly stems: ReadonlySet<string>;
}): readonly string[] => {
  const walk = (directory: string): readonly string[] =>
    readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        return entry.startsWith(".") || entry === "audit" ? [] : walk(path);
      }
      return entry.endsWith(".md") && stems.has(entry.replace(/\.md$/, ""))
        ? [path]
        : [];
    });
  return walk(recordDir);
};

type RecordInspection =
  | { readonly kind: "inspected"; readonly findings: readonly Finding[] }
  | { readonly kind: "unmeasurable"; readonly reason: "no-stage-graph" };

const inspectRecordDirectory = ({
  recordDir,
  stageGraphPath,
}: {
  readonly recordDir: string;
  readonly stageGraphPath: string;
}): RecordInspection => {
  const stems = officialArtefactStems({ stageGraphPath });
  if (stems === undefined) {
    return { kind: "unmeasurable", reason: "no-stage-graph" };
  }
  const proseDocuments = officialProseIn({ recordDir, stems }).map((path) => ({
    name: basename(path),
    body: readFileSync(path, "utf8"),
  }));

  const unchainedExceptions = findUnchainedExceptionFindings({
    proseDocuments,
  });

  const factsPath = join(recordDir, FACTS_FILENAME);
  if (!existsSync(factsPath)) {
    return { kind: "inspected", findings: unchainedExceptions };
  }
  const sources = {
    factsBody: readFileSync(factsPath, "utf8"),
    proseDocuments,
  };
  return {
    kind: "inspected",
    findings: [
      ...findKeyIntegrityFindings(sources),
      ...findBareFigureFindings(sources),
      ...unchainedExceptions,
    ],
  };
};

export {
  collectDefinedKeys,
  collectReferences,
  type DocRule,
  type Finding,
  findBareFigureFindings,
  findKeyIntegrityFindings,
  findUnchainedExceptionFindings,
  inspectRecordDirectory,
  officialArtefactStems,
  officialProseIn,
  type ProseDocument,
  type RecordInspection,
  type RecordSources,
};
