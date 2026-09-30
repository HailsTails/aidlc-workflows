import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const FACT_ROW = /^\|\s*\*\*([A-Z]+-\d+)\*\*\s*\|/;
const KEY_REFERENCE = /\b([A-Z]+-\d+)\b/g;

// Rule-id namespaces are NOT fact keys. They share the <PREFIX>-<N> shape, so a
// prose citation of DD-4 or CD-19 would otherwise read as a dangling reference.
const RESERVED_PREFIXES = new Set(["DD", "CD", "IF", "G3", "FR", "AC", "NFR"]);

const isReservedKey = ({ key }: { readonly key: string }): boolean =>
  RESERVED_PREFIXES.has(key.split("-")[0] ?? "");
const FENCE = /^\s*```/;
const TABLE_ROW = /^\s*\|/;

const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
const RECORD_SLUG = /\b\d{6}-[a-z0-9-]+/g;
const PR_REFERENCE = /#\d+/g;
const SECTION_REFERENCE = /§\s*\d+[a-z]?/g;
const GATE_REFERENCE = /\b[Gg]ate\s+\d+/g;
const ALLOWED_BARE = [/^20\d{2}$/, /^\d{1,2}$/];

const FACTS_FILENAME = "facts.md";

type DocRule = "DD-1" | "DD-2" | "DD-3";

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
      definedKeys.has(key)
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

const officialArtefactStems = ({
  stageGraphPath,
}: {
  readonly stageGraphPath: string;
}): ReadonlySet<string> => {
  if (!existsSync(stageGraphPath)) {
    return new Set();
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

const inspectRecordDirectory = ({
  recordDir,
  stageGraphPath,
}: {
  readonly recordDir: string;
  readonly stageGraphPath: string;
}): readonly Finding[] => {
  const factsPath = join(recordDir, FACTS_FILENAME);
  if (!existsSync(factsPath)) {
    return [];
  }
  const stems = officialArtefactStems({ stageGraphPath });
  const proseDocuments = officialProseIn({ recordDir, stems }).map((path) => ({
    name: basename(path),
    body: readFileSync(path, "utf8"),
  }));
  const sources = {
    factsBody: readFileSync(factsPath, "utf8"),
    proseDocuments,
  };
  return [
    ...findKeyIntegrityFindings(sources),
    ...findBareFigureFindings(sources),
  ];
};

export {
  collectDefinedKeys,
  collectReferences,
  type DocRule,
  type Finding,
  findBareFigureFindings,
  findKeyIntegrityFindings,
  inspectRecordDirectory,
  officialArtefactStems,
  officialProseIn,
  type ProseDocument,
  type RecordSources,
};
