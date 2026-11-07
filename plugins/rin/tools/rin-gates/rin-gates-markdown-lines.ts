type LineRegion =
  | { readonly kind: "frontmatter" }
  | { readonly kind: "prose" }
  | { readonly kind: "fence-open"; readonly language: string }
  | {
      readonly kind: "fence-body";
      readonly language: string;
      readonly openingLineNumber: number;
    }
  | { readonly kind: "fence-close" };

type MarkdownLine = {
  readonly lineNumber: number;
  readonly text: string;
  readonly region: LineRegion;
};

type HeadingSection = {
  readonly title: string;
  readonly headingLineNumber: number;
  readonly sectionLines: readonly MarkdownLine[];
};

type FenceState =
  | { readonly kind: "outside" }
  | {
      readonly kind: "inside";
      readonly marker: string;
      readonly language: string;
      readonly openingLineNumber: number;
    };

type LineClassification = {
  readonly state: FenceState;
  readonly markdownLine: MarkdownLine;
};

type FenceScan = {
  readonly state: FenceState;
  readonly lines: readonly MarkdownLine[];
};

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FRONTMATTER_DELIMITER = "---";
const FRONTMATTER_CLOSERS: ReadonlySet<string> = new Set(["---", "..."]);

const languageOf = ({ infoString }: { readonly infoString: string }): string =>
  (infoString.replace(/^\{?\.?/, "").split(/[:,{}]/)[0] ?? "").toLowerCase();

const frontmatterLineCountOf = ({
  rawLines,
}: {
  readonly rawLines: readonly string[];
}): number => {
  if (rawLines[0]?.trimEnd() !== FRONTMATTER_DELIMITER) {
    return 0;
  }
  const closingDelimiterIndex = rawLines.findIndex(
    (text, index) => index > 0 && FRONTMATTER_CLOSERS.has(text.trimEnd()),
  );
  return closingDelimiterIndex === -1 ? 0 : closingDelimiterIndex + 1;
};

type FenceLineRole = "closes-fence" | "inside-fence";

const fenceLineRoleOf = ({
  text,
  marker,
}: {
  readonly text: string;
  readonly marker: string;
}): FenceLineRole => {
  const closingMarker = text.match(FENCE_CLOSE)?.[1] ?? "";
  return closingMarker.startsWith(marker.charAt(0)) &&
    closingMarker.length >= marker.length
    ? "closes-fence"
    : "inside-fence";
};

const classifyOutside = ({
  text,
  lineNumber,
}: {
  readonly text: string;
  readonly lineNumber: number;
}): LineClassification => {
  const fenceOpeningMatch = text.match(FENCE_OPEN);
  const marker = fenceOpeningMatch?.[1];
  if (marker === undefined) {
    return {
      state: { kind: "outside" },
      markdownLine: { lineNumber, text, region: { kind: "prose" } },
    };
  }
  const language = languageOf({ infoString: fenceOpeningMatch?.[2] ?? "" });
  return {
    state: { kind: "inside", marker, language, openingLineNumber: lineNumber },
    markdownLine: {
      lineNumber,
      text,
      region: { kind: "fence-open", language },
    },
  };
};

const classifyInside = ({
  text,
  lineNumber,
  state,
}: {
  readonly text: string;
  readonly lineNumber: number;
  readonly state: Extract<FenceState, { readonly kind: "inside" }>;
}): LineClassification =>
  fenceLineRoleOf({ text, marker: state.marker }) === "closes-fence"
    ? {
        state: { kind: "outside" },
        markdownLine: { lineNumber, text, region: { kind: "fence-close" } },
      }
    : {
        state,
        markdownLine: {
          lineNumber,
          text,
          region: {
            kind: "fence-body",
            language: state.language,
            openingLineNumber: state.openingLineNumber,
          },
        },
      };

const classifyLine = ({
  text,
  lineNumber,
  state,
}: {
  readonly text: string;
  readonly lineNumber: number;
  readonly state: FenceState;
}): LineClassification => {
  switch (state.kind) {
    case "outside":
      return classifyOutside({ text, lineNumber });
    case "inside":
      return classifyInside({ text, lineNumber, state });
  }
};

const markdownLinesOf = ({
  markdownText,
}: {
  readonly markdownText: string;
}): readonly MarkdownLine[] => {
  const rawLines = markdownText.split(/\r?\n/);
  const frontmatterLineCount = frontmatterLineCountOf({ rawLines });
  const frontmatterLines: readonly MarkdownLine[] = rawLines
    .slice(0, frontmatterLineCount)
    .map((text, index) => ({
      lineNumber: index + 1,
      text,
      region: { kind: "frontmatter" },
    }));
  const fenceScan = rawLines
    .map((text, index) => ({ text, lineNumber: index + 1 }))
    .slice(frontmatterLineCount)
    .reduce<FenceScan>(
      (scanSoFar, { text, lineNumber }) => {
        const lineClassification = classifyLine({
          text,
          lineNumber,
          state: scanSoFar.state,
        });
        return {
          state: lineClassification.state,
          lines: [...scanSoFar.lines, lineClassification.markdownLine],
        };
      },
      { state: { kind: "outside" }, lines: [] },
    );
  return [...frontmatterLines, ...fenceScan.lines];
};

const headingOf = ({
  markdownLine,
}: {
  readonly markdownLine: MarkdownLine;
}): { readonly level: number; readonly title: string } | undefined => {
  if (markdownLine.region.kind !== "prose") {
    return undefined;
  }
  const headingMatch = markdownLine.text.match(HEADING);
  const headingMarker = headingMatch?.[1];
  if (headingMarker === undefined) {
    return undefined;
  }
  return { level: headingMarker.length, title: headingMatch?.[2] ?? "" };
};

const sectionsAtLevel = ({
  lines,
  level,
}: {
  readonly lines: readonly MarkdownLine[];
  readonly level: number;
}): readonly HeadingSection[] =>
  lines.flatMap((markdownLine, index) => {
    const heading = headingOf({ markdownLine });
    if (heading === undefined || heading.level !== level) {
      return [];
    }
    const linesAfterHeading = lines.slice(index + 1);
    const nextSectionOffset = linesAfterHeading.findIndex((laterLine) => {
      const followingHeading = headingOf({ markdownLine: laterLine });
      return followingHeading !== undefined && followingHeading.level <= level;
    });
    return [
      {
        title: heading.title,
        headingLineNumber: markdownLine.lineNumber,
        sectionLines:
          nextSectionOffset === -1
            ? linesAfterHeading
            : linesAfterHeading.slice(0, nextSectionOffset),
      },
    ];
  });

const statedTokenOf = ({ text }: { readonly text: string }): string =>
  text.replace(/[`*]/g, "").trim().replace(/\.$/, "").trim();

const closedTokenOf = <Token extends string>({
  text,
  tokens,
}: {
  readonly text: string;
  readonly tokens: readonly Token[];
}): Token | undefined => {
  const statedToken = statedTokenOf({ text });
  return tokens.find((token) => token === statedToken);
};

const proseOf = ({
  lines,
}: {
  readonly lines: readonly MarkdownLine[];
}): readonly MarkdownLine[] =>
  lines.filter((markdownLine) => markdownLine.region.kind === "prose");

export {
  closedTokenOf,
  type HeadingSection,
  headingOf,
  type LineRegion,
  type MarkdownLine,
  markdownLinesOf,
  proseOf,
  sectionsAtLevel,
  statedTokenOf,
};
