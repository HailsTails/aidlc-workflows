import { z } from "zod";
import {
  defaultPathOperations,
  type PathOperations,
} from "./rin-harness-path-operations.ts";
import {
  defaultFileKindPort,
  defaultSidecarFileReader,
  type FileKindPort,
  type SidecarFileReader,
} from "./rin-harness-sidecar-file-reader.ts";
import { CHAIN_LABEL } from "./rin-harness-why-chain.ts";

const FACT_ROW = /^\|\s*\*\*([A-Z]+-\d+)\*\*\s*\|/;
const KEY_REFERENCE = /\b([A-Z]+-\d+)\b/g;

const RESERVED_PREFIXES = new Set(["DD", "CD", "PD", "IF", "G3", "FR", "AC", "NFR"]);

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

type RecordPorts = {
  readonly reader: SidecarFileReader;
  readonly kinds: FileKindPort;
  readonly paths: PathOperations;
};

const defaultRecordPorts = (): RecordPorts => ({
  reader: defaultSidecarFileReader(),
  kinds: defaultFileKindPort(),
  paths: defaultPathOperations(),
});

type UnmeasurableReason =
  | "no-stage-graph"
  | "stage-graph-unreadable"
  | "stage-graph-malformed"
  | "record-file-unreadable"
  | "record-directory-unreadable";

type Unmeasurable = {
  readonly kind: "unmeasurable";
  readonly reason: UnmeasurableReason;
  readonly path: string;
};

const stageNodeSchema = z.object({
  produces: z.array(z.string()).optional(),
});

const stageGraphSchema = z.union([
  z.array(stageNodeSchema),
  z.object({ stages: z.array(stageNodeSchema).optional() }),
]);

type StageGraph = z.infer<typeof stageGraphSchema>;

const parseStageGraph = ({
  raw,
}: {
  readonly raw: string;
}): StageGraph | undefined => {
  try {
    const parsed = stageGraphSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

type StemsRead =
  | { readonly kind: "resolved"; readonly stems: ReadonlySet<string> }
  | Unmeasurable;

const officialArtefactStems = ({
  stageGraphPath,
  reader,
}: {
  readonly stageGraphPath: string;
  readonly reader: SidecarFileReader;
}): StemsRead => {
  if (!reader.fileExists(stageGraphPath)) {
    return {
      kind: "unmeasurable",
      reason: "no-stage-graph",
      path: stageGraphPath,
    };
  }
  const raw = reader.readFile(stageGraphPath);
  if (raw === undefined) {
    return {
      kind: "unmeasurable",
      reason: "stage-graph-unreadable",
      path: stageGraphPath,
    };
  }
  const graph = parseStageGraph({ raw });
  if (graph === undefined) {
    return {
      kind: "unmeasurable",
      reason: "stage-graph-malformed",
      path: stageGraphPath,
    };
  }
  const nodes = Array.isArray(graph) ? graph : (graph.stages ?? []);
  return {
    kind: "resolved",
    stems: new Set(nodes.flatMap((node) => node.produces ?? [])),
  };
};

type ProsePathsListed =
  | { readonly kind: "listed"; readonly paths: readonly string[] }
  | Unmeasurable;

const officialProseIn = ({
  recordDir,
  stems,
  ports,
}: {
  readonly recordDir: string;
  readonly stems: ReadonlySet<string>;
  readonly ports: RecordPorts;
}): ProsePathsListed => {
  const walk = (directory: string): ProsePathsListed => {
    const entries = ports.reader.listDirectory(directory);
    if (entries === undefined) {
      return {
        kind: "unmeasurable",
        reason: "record-directory-unreadable",
        path: directory,
      };
    }
    const listings = entries.map((entry): ProsePathsListed => {
      const path = ports.paths.join({ segments: [directory, entry] });
      if (ports.kinds.isDirectory(path)) {
        return entry.startsWith(".") || entry === "audit"
          ? { kind: "listed", paths: [] }
          : walk(path);
      }
      return {
        kind: "listed",
        paths:
          entry.endsWith(".md") && stems.has(entry.replace(/\.md$/, ""))
            ? [path]
            : [],
      };
    });
    const unlistable = listings.find(
      (listing): listing is Unmeasurable => listing.kind === "unmeasurable",
    );
    if (unlistable !== undefined) {
      return unlistable;
    }
    return {
      kind: "listed",
      paths: listings.flatMap((listing) =>
        listing.kind === "listed" ? listing.paths : [],
      ),
    };
  };
  return walk(recordDir);
};

type ProseRead =
  | { readonly kind: "read"; readonly document: ProseDocument }
  | Unmeasurable;

const readProseDocument = ({
  path,
  ports,
}: {
  readonly path: string;
  readonly ports: RecordPorts;
}): ProseRead => {
  const body = ports.reader.readFile(path);
  if (body === undefined) {
    return { kind: "unmeasurable", reason: "record-file-unreadable", path };
  }
  return {
    kind: "read",
    document: { name: ports.paths.basename({ path }), body },
  };
};

type ProseDocumentsRead =
  | { readonly kind: "read"; readonly documents: readonly ProseDocument[] }
  | Unmeasurable;

const readProseDocuments = ({
  paths,
  ports,
}: {
  readonly paths: readonly string[];
  readonly ports: RecordPorts;
}): ProseDocumentsRead => {
  const reads = paths.map((path) => readProseDocument({ path, ports }));
  const unreadable = reads.find(
    (read): read is Unmeasurable => read.kind === "unmeasurable",
  );
  if (unreadable !== undefined) {
    return unreadable;
  }
  return {
    kind: "read",
    documents: reads.flatMap((read) =>
      read.kind === "read" ? [read.document] : [],
    ),
  };
};

type FactsRead =
  | { readonly kind: "absent" }
  | { readonly kind: "read"; readonly body: string }
  | Unmeasurable;

const readFacts = ({
  recordDir,
  ports,
}: {
  readonly recordDir: string;
  readonly ports: RecordPorts;
}): FactsRead => {
  const path = ports.paths.join({ segments: [recordDir, FACTS_FILENAME] });
  if (!ports.reader.fileExists(path)) {
    return { kind: "absent" };
  }
  const body = ports.reader.readFile(path);
  if (body === undefined) {
    return { kind: "unmeasurable", reason: "record-file-unreadable", path };
  }
  return { kind: "read", body };
};

type RecordInspection =
  | { readonly kind: "inspected"; readonly findings: readonly Finding[] }
  | Unmeasurable;

const describeUnmeasurable = ({
  reason,
  path,
}: {
  readonly reason: UnmeasurableReason;
  readonly path: string;
}): string => {
  switch (reason) {
    case "no-stage-graph":
      return `${reason}: ${path} is absent, so the official-artefact set (DD-4) could not be resolved`;
    case "stage-graph-unreadable":
      return `${reason}: ${path} exists but could not be read, so the official-artefact set (DD-4) could not be resolved`;
    case "stage-graph-malformed":
      return `${reason}: ${path} is not a valid stage graph, so the official-artefact set (DD-4) could not be resolved`;
    case "record-file-unreadable":
      return `${reason}: ${path} exists but could not be read, so its findings could not be measured`;
    case "record-directory-unreadable":
      return `${reason}: ${path} exists but could not be listed, so its findings could not be measured`;
  }
};

const inspectRecordDirectory = ({
  recordDir,
  stageGraphPath,
  ports = defaultRecordPorts(),
}: {
  readonly recordDir: string;
  readonly stageGraphPath: string;
  readonly ports?: RecordPorts;
}): RecordInspection => {
  const stemsRead = officialArtefactStems({
    stageGraphPath,
    reader: ports.reader,
  });
  if (stemsRead.kind === "unmeasurable") {
    return stemsRead;
  }
  const prosePaths = officialProseIn({
    recordDir,
    stems: stemsRead.stems,
    ports,
  });
  if (prosePaths.kind === "unmeasurable") {
    return prosePaths;
  }
  const proseRead = readProseDocuments({ paths: prosePaths.paths, ports });
  if (proseRead.kind === "unmeasurable") {
    return proseRead;
  }
  const proseDocuments = proseRead.documents;

  const unchainedExceptions = findUnchainedExceptionFindings({
    proseDocuments,
  });

  const factsRead = readFacts({ recordDir, ports });
  if (factsRead.kind === "unmeasurable") {
    return factsRead;
  }
  if (factsRead.kind === "absent") {
    return { kind: "inspected", findings: unchainedExceptions };
  }
  const sources = {
    factsBody: factsRead.body,
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
  defaultRecordPorts,
  describeUnmeasurable,
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
  type RecordPorts,
  type RecordSources,
};
