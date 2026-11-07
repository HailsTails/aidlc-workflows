// Literal shell syntax only. Never execute or expand a word to inspect a command.
type LiteralInvocation = {
  directory: string | null;
  command: string;
  argv: string[];
  rawWords: string[];
};

type LiteralWord = {
  kind: "unquoted" | "single-quoted" | "double-quoted" | "double-escape";
  start: number;
  decoded: string;
};

type LiteralState = LiteralWord | { kind: "between" } | { kind: "and-tail" } | { kind: "rejected" };
type ShellUnit = { character: string; following: string; offset: number };
type LiteralToken = { kind: "word" | "and"; start: number; end: number; decoded: string };
type LiteralStep = { state: LiteralState; tokens: LiteralToken[] };

function completeWord(word: LiteralWord, end: number): LiteralToken {
  return { kind: "word", start: word.start, end, decoded: word.decoded };
}

function consumeAnd(unit: ShellUnit): LiteralStep {
  return {
    state: { kind: "and-tail" },
    tokens: [{ kind: "and", start: unit.offset, end: unit.offset + 2, decoded: "&&" }],
  };
}

function advanceUnquoted(word: LiteralWord, unit: ShellUnit): LiteralStep {
  if (unit.character === " " || unit.character === "\t") {
    return { state: { kind: "between" }, tokens: [completeWord(word, unit.offset)] };
  }
  if (unit.character === "&" && unit.following === "&") {
    const separator = consumeAnd(unit);
    return { state: separator.state, tokens: [completeWord(word, unit.offset), ...separator.tokens] };
  }
  if (unit.character === "'" || unit.character === '"') {
    return {
      state: { ...word, kind: unit.character === "'" ? "single-quoted" : "double-quoted" },
      tokens: [],
    };
  }
  if (
    unit.character === "\\" || "()[]{}*?;|<>&$#".includes(unit.character) ||
    (unit.character === "~" && unit.offset === word.start)
  ) return { state: { kind: "rejected" }, tokens: [] };
  return { state: { ...word, decoded: word.decoded + unit.character }, tokens: [] };
}

function advanceDoubleQuoted(word: LiteralWord, unit: ShellUnit): LiteralStep {
  if (unit.character === '"') return { state: { ...word, kind: "unquoted" }, tokens: [] };
  if (unit.character === "$") return { state: { kind: "rejected" }, tokens: [] };
  if (unit.character === "\\" && /["\\$`]/.test(unit.following)) {
    return { state: { ...word, kind: "double-escape" }, tokens: [] };
  }
  return { state: { ...word, decoded: word.decoded + unit.character }, tokens: [] };
}

function advanceLiteral(state: LiteralState, unit: ShellUnit): LiteralStep {
  if (state.kind === "rejected") return { state, tokens: [] };
  if (state.kind === "and-tail") return { state: { kind: "between" }, tokens: [] };
  if (state.kind === "between") {
    if (unit.character === " " || unit.character === "\t") return { state, tokens: [] };
    if (unit.character === "&" && unit.following === "&") return consumeAnd(unit);
    return advanceUnquoted({ kind: "unquoted", start: unit.offset, decoded: "" }, unit);
  }
  if (state.kind === "single-quoted") {
    return {
      state: unit.character === "'"
        ? { ...state, kind: "unquoted" }
        : { ...state, decoded: state.decoded + unit.character },
      tokens: [],
    };
  }
  if (state.kind === "double-quoted") return advanceDoubleQuoted(state, unit);
  if (state.kind === "double-escape") {
    return { state: { ...state, kind: "double-quoted", decoded: state.decoded + unit.character }, tokens: [] };
  }
  return advanceUnquoted(state, unit);
}

function scanLiteralTokens(text: string): LiteralToken[] | null {
  const scanner: { state: LiteralState } = { state: { kind: "between" } };
  // split("") preserves UTF-16 offsets, including lone surrogates, used by raw slices.
  const tokens = text.split("").flatMap((character, offset) => {
    const step = advanceLiteral(scanner.state, { character, following: text[offset + 1] ?? "", offset });
    scanner.state = step.state;
    return step.tokens;
  });
  if (scanner.state.kind === "between") return tokens;
  if (scanner.state.kind !== "unquoted") return null;
  return [...tokens, completeWord(scanner.state, text.length)];
}

function invocationWords(tokens: LiteralToken[], text: string): { directory: string | null; words: LiteralToken[] } | null {
  const separators = tokens.flatMap((token, index) => token.kind === "and" ? [index] : []);
  if (separators.length === 0) return { directory: null, words: tokens };
  const separator = separators[0];
  if (separators.length !== 1 || separator === undefined) return null;
  const prefix = tokens.slice(0, separator);
  const [first, second] = prefix;
  if (first === undefined || text.slice(first.start, first.end) !== "cd") return null;
  if (prefix.length !== 2 && !(prefix.length === 3 && second !== undefined && text.slice(second.start, second.end) === "--")) return null;
  const directory = prefix.at(-1)?.decoded;
  if (directory === undefined) return null;
  if (!directory.startsWith("/") && !/^[A-Za-z]:[/\\]/.test(directory) && !/^\\\\[^/\\]+[/\\][^/\\]+/.test(directory)) return null;
  return { directory, words: tokens.slice(separator + 1) };
}

export function parseLiteralShellInvocation(text: string): LiteralInvocation | null {
  if (/[\0\r\n]|\$\(|`/.test(text)) return null;
  const command = text.replace(/^[ \t]+|[ \t]+$/g, "").replace(/[ \t]+2>&1$/, "");
  const tokens = scanLiteralTokens(command);
  if (tokens === null) return null;
  const invocation = invocationWords(tokens, command);
  if (invocation === null) return null;
  const first = invocation.words[0];
  if (first === undefined) return null;
  return {
    directory: invocation.directory,
    command: command.slice(first.start),
    argv: invocation.words.map((word) => word.decoded),
    rawWords: invocation.words.map((word) => command.slice(word.start, word.end)),
  };
}

type SegmentMode = "unquoted" | "single-quoted" | "double-quoted" | "unquoted-escape" | "double-escape" | "and-tail";
type SegmentStep = { mode: SegmentMode; separatorWidth: 0 | 1 | 2 };

function advanceSegment(mode: SegmentMode, unit: ShellUnit): SegmentStep {
  if (mode === "unquoted-escape" || mode === "and-tail") return { mode: "unquoted", separatorWidth: 0 };
  if (mode === "double-escape") return { mode: "double-quoted", separatorWidth: 0 };
  if (mode === "single-quoted") {
    return { mode: unit.character === "'" ? "unquoted" : mode, separatorWidth: 0 };
  }
  if (unit.character === "\\") {
    return { mode: mode === "double-quoted" ? "double-escape" : "unquoted-escape", separatorWidth: 0 };
  }
  if (mode === "double-quoted") {
    return { mode: unit.character === '"' ? "unquoted" : mode, separatorWidth: 0 };
  }
  return advanceSegmentBoundary(unit);
}

function advanceSegmentBoundary(unit: ShellUnit): SegmentStep {
  if (unit.character === "'" || unit.character === '"') {
    return { mode: unit.character === "'" ? "single-quoted" : "double-quoted", separatorWidth: 0 };
  }
  if (unit.character === "&" && unit.following === "&") return { mode: "and-tail", separatorWidth: 2 };
  if (unit.character === "|" || unit.character === ";" || unit.character === "\n") {
    return { mode: "unquoted", separatorWidth: 1 };
  }
  return { mode: "unquoted", separatorWidth: 0 };
}

// Segmentation is intentionally permissive: unmatched quotes/escapes remain raw text.
export function shellCommandSegments(command: string): string[] {
  const scanner: { mode: SegmentMode; start: number } = { mode: "unquoted", start: 0 };
  const segments = command.split("").flatMap((character, offset) => {
    const step = advanceSegment(scanner.mode, { character, following: command[offset + 1] ?? "", offset });
    scanner.mode = step.mode;
    if (step.separatorWidth === 0) return [];
    const segment = command.slice(scanner.start, offset);
    scanner.start = offset + step.separatorWidth;
    return [segment];
  });
  return [...segments, command.slice(scanner.start)];
}
