type SimpleCommand = readonly string[];

type Closer = ")" | "`" | null;

type PendingHeredoc = {
  readonly delimiter: string;
  readonly stripsTabs: boolean;
  readonly expands: boolean;
};

type CommandFrame = {
  readonly kind: "command";
  readonly closer: Closer;
  readonly words: readonly string[];
  readonly word: string;
  readonly inWord: boolean;
};

type TextFrame = {
  readonly kind: "single-quote" | "double-quote" | "comment" | "parameter";
};

type EscapeFrame = {
  readonly kind: "escape";
  readonly inDoubleQuotes: boolean;
};

type HeredocDelimiterFrame = {
  readonly kind: "heredoc-delimiter";
  readonly delimiter: string;
  readonly openQuote: string | null;
  readonly quoted: boolean;
  readonly stripsTabs: boolean;
};

type HeredocBodyFrame = {
  readonly kind: "heredoc-body";
  readonly heredoc: PendingHeredoc;
  readonly line: string;
};

type Frame =
  | CommandFrame
  | TextFrame
  | EscapeFrame
  | HeredocDelimiterFrame
  | HeredocBodyFrame;

type ScanState = {
  readonly frames: readonly Frame[];
  readonly commands: readonly SimpleCommand[];
  readonly pendingHeredocs: readonly PendingHeredoc[];
  readonly skip: number;
};

type Cursor = {
  readonly current: string;
  readonly next: string;
  readonly afterNext: string;
};

const COMMAND_SEPARATORS: ReadonlySet<string> = new Set([";", "&", "|", "(", ")"]);
const BRACE_GROUP_MARKERS: ReadonlySet<string> = new Set(["{", "}"]);
const DELIMITER_BOUNDARY = /[\s;&|()<>]/;
const DOUBLE_QUOTE_ESCAPABLE = '"\\$`';

const commandFrame = ({ closer }: { readonly closer: Closer }): CommandFrame => ({
  kind: "command",
  closer,
  words: [],
  word: "",
  inWord: false,
});

const topOf = ({ frames }: ScanState): Frame | undefined => frames[frames.length - 1];

const pushed = (state: ScanState, frame: Frame): ScanState => ({
  ...state,
  frames: [...state.frames, frame],
});

const popped = (state: ScanState): ScanState => ({
  ...state,
  frames: state.frames.slice(0, -1),
});

const withTop = (state: ScanState, frame: Frame): ScanState =>
  pushed(popped(state), frame);

const skipping = (state: ScanState, skip: number): ScanState => ({ ...state, skip });

const nearestCommandIndex = ({ frames }: ScanState): number =>
  frames.reduce(
    (found, frame, index) => (frame.kind === "command" ? index : found),
    0,
  );

const withNearestCommand = (
  state: ScanState,
  update: (frame: CommandFrame) => {
    readonly frame: CommandFrame;
    readonly completed: readonly SimpleCommand[];
  },
): ScanState => {
  const index = nearestCommandIndex(state);
  const frame = state.frames[index];
  if (frame?.kind !== "command") return state;
  const updated = update(frame);
  return {
    ...state,
    frames: state.frames.map((existing, position) =>
      position === index ? updated.frame : existing,
    ),
    commands: [...state.commands, ...updated.completed],
  };
};

const appendedToWord = (state: ScanState, text: string): ScanState =>
  withNearestCommand(state, (frame) => ({
    frame: { ...frame, word: frame.word + text, inWord: true },
    completed: [],
  }));

const withWordEnded = (frame: CommandFrame): CommandFrame => ({
  ...frame,
  words: frame.inWord ? [...frame.words, frame.word] : frame.words,
  word: "",
  inWord: false,
});

const completedCommandsOf = (frame: CommandFrame): readonly SimpleCommand[] => {
  const { words } = withWordEnded(frame);
  return words.length > 0 ? [words] : [];
};

const wordEnded = (state: ScanState): ScanState =>
  withNearestCommand(state, (frame) => ({ frame: withWordEnded(frame), completed: [] }));

const commandEnded = (state: ScanState): ScanState =>
  withNearestCommand(state, (frame) => ({
    frame: { ...withWordEnded(frame), words: [] },
    completed: completedCommandsOf(frame),
  }));

const withNextHeredocBody = (state: ScanState): ScanState => {
  const [heredoc, ...remaining] = state.pendingHeredocs;
  if (heredoc === undefined) return state;
  return pushed({ ...state, pendingHeredocs: remaining }, { kind: "heredoc-body", heredoc, line: "" });
};

const isHeredocTerminator = ({ heredoc, line }: HeredocBodyFrame): boolean =>
  (heredoc.stripsTabs ? line.replace(/^\t+/, "") : line).replace(/\r$/, "") ===
  heredoc.delimiter;

const afterEscape = (state: ScanState, frame: EscapeFrame, { current }: Cursor): ScanState => {
  const unescaped = popped(state);
  if (current === "\n") return unescaped;
  if (frame.inDoubleQuotes)
    return appendedToWord(unescaped, DOUBLE_QUOTE_ESCAPABLE.includes(current) ? current : `\\${current}`);
  return appendedToWord(unescaped, `\\${current}`);
};

const inDoubleQuotes = (state: ScanState, { current, next }: Cursor): ScanState => {
  if (current === '"') return popped(state);
  if (current === "\\") return pushed(state, { kind: "escape", inDoubleQuotes: true });
  if (current === "$" && next === "(")
    return skipping(pushed(state, commandFrame({ closer: ")" })), 1);
  if (current === "`") return pushed(state, commandFrame({ closer: "`" }));
  return appendedToWord(state, current);
};

const finishedDelimiter = (state: ScanState, frame: HeredocDelimiterFrame): ScanState => ({
  ...popped(state),
  pendingHeredocs: [
    ...state.pendingHeredocs,
    { delimiter: frame.delimiter, stripsTabs: frame.stripsTabs, expands: !frame.quoted },
  ],
});

const inHeredocDelimiter = (
  state: ScanState,
  frame: HeredocDelimiterFrame,
  cursor: Cursor,
): ScanState => {
  const { current } = cursor;
  if (frame.openQuote !== null)
    return withTop(state, current === frame.openQuote
      ? { ...frame, openQuote: null }
      : { ...frame, delimiter: frame.delimiter + current });
  if (current === "'" || current === '"')
    return withTop(state, { ...frame, openQuote: current, quoted: true });
  if (current === "\\") return withTop(state, { ...frame, quoted: true });
  if (frame.delimiter === "" && (current === " " || current === "\t")) return state;
  if (DELIMITER_BOUNDARY.test(current))
    return scannedCharacter(finishedDelimiter(state, frame), cursor);
  return withTop(state, { ...frame, delimiter: frame.delimiter + current });
};

const inHeredocBody = (state: ScanState, frame: HeredocBodyFrame, { current, next }: Cursor): ScanState => {
  if (current === "\n")
    return isHeredocTerminator(frame)
      ? withNextHeredocBody(popped(state))
      : withTop(state, { ...frame, line: "" });
  if (frame.heredoc.expands && current === "\\")
    return skipping(withTop(state, { ...frame, line: frame.line + current + next }), 1);
  if (frame.heredoc.expands && current === "$" && next === "(")
    return skipping(pushed(state, commandFrame({ closer: ")" })), 1);
  if (frame.heredoc.expands && current === "`")
    return pushed(state, commandFrame({ closer: "`" }));
  return withTop(state, { ...frame, line: frame.line + current });
};

const closedSubstitution = (state: ScanState): ScanState => {
  const parent = popped(commandEnded(state));
  return topOf(parent)?.kind === "command" ? appendedToWord(parent, "") : parent;
};

const openedHeredoc = (state: ScanState, { afterNext }: Cursor): ScanState => {
  const stripsTabs = afterNext === "-";
  return skipping(
    pushed(wordEnded(state), {
      kind: "heredoc-delimiter",
      delimiter: "",
      openQuote: null,
      quoted: false,
      stripsTabs,
    }),
    stripsTabs ? 2 : 1,
  );
};

const inCommand = (state: ScanState, frame: CommandFrame, cursor: Cursor): ScanState => {
  const { current, next, afterNext } = cursor;
  if (frame.closer !== null && current === frame.closer) return closedSubstitution(state);
  if (current === "\n") return withNextHeredocBody(commandEnded(state));
  if (current === "\\") return pushed(state, { kind: "escape", inDoubleQuotes: false });
  if (current === "'") return pushed(appendedToWord(state, ""), { kind: "single-quote" });
  if (current === '"') return pushed(appendedToWord(state, ""), { kind: "double-quote" });
  if (current === "$" && next === "(")
    return skipping(pushed(appendedToWord(state, ""), commandFrame({ closer: ")" })), 1);
  if (current === "$" && next === "{") return pushed(appendedToWord(state, current), { kind: "parameter" });
  if (current === "`") return pushed(appendedToWord(state, ""), commandFrame({ closer: "`" }));
  if (current === "<" && next === "<" && afterNext === "<")
    return skipping(appendedToWord(state, "<<<"), 2);
  if (current === "<" && next === "<") return openedHeredoc(state, cursor);
  if (current === "#" && !frame.inWord) return pushed(state, { kind: "comment" });
  if (COMMAND_SEPARATORS.has(current)) return commandEnded(state);
  if (BRACE_GROUP_MARKERS.has(current) && !frame.inWord) return commandEnded(state);
  if (/\s/.test(current)) return wordEnded(state);
  return appendedToWord(state, current);
};

const scannedCharacter = (state: ScanState, cursor: Cursor): ScanState => {
  const frame = topOf(state);
  const { current } = cursor;
  switch (frame?.kind) {
    case "escape":
      return afterEscape(state, frame, cursor);
    case "single-quote":
      return current === "'" ? popped(state) : appendedToWord(state, current);
    case "double-quote":
      return inDoubleQuotes(state, cursor);
    case "comment":
      return current === "\n" ? scannedCharacter(popped(state), cursor) : state;
    case "parameter":
      return current === "}" ? popped(appendedToWord(state, current)) : appendedToWord(state, current);
    case "heredoc-delimiter":
      return inHeredocDelimiter(state, frame, cursor);
    case "heredoc-body":
      return inHeredocBody(state, frame, cursor);
    case "command":
      return inCommand(state, frame, cursor);
    default:
      return state;
  }
};

const unfinishedCommandsOf = ({ frames }: ScanState): readonly SimpleCommand[] =>
  frames.flatMap((frame) => (frame.kind === "command" ? completedCommandsOf(frame) : []));

const simpleCommandsOf = ({
  source,
}: {
  readonly source: string;
}): readonly SimpleCommand[] => {
  const characters = Array.from(source);
  const scanned = characters.reduce<ScanState>(
    (state, current, index) =>
      state.skip > 0
        ? skipping(state, state.skip - 1)
        : scannedCharacter(state, {
            current,
            next: characters[index + 1] ?? "",
            afterNext: characters[index + 2] ?? "",
          }),
    { frames: [commandFrame({ closer: null })], commands: [], pendingHeredocs: [], skip: 0 },
  );
  return [...scanned.commands, ...unfinishedCommandsOf(scanned)];
};

export type { SimpleCommand };
export { simpleCommandsOf };
