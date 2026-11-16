type SimpleCommand = readonly string[];

type List<Value> = { readonly head: Value; readonly tail: List<Value> } | null;

type CountedList<Value> = { readonly items: List<Value>; readonly length: number };

type Closer = ")" | "`" | null;

type PendingHeredoc = {
  readonly delimiter: string;
  readonly stripsTabs: boolean;
  readonly expands: boolean;
};

type CommandFrame = {
  readonly kind: "command";
  readonly closer: Closer;
  readonly words: CountedList<string>;
  readonly word: string;
  readonly inWord: boolean;
};

type TextFrame = {
  readonly kind: "single-quote" | "double-quote" | "ansi-c-quote" | "comment" | "parameter";
};

type EscapeFrame = {
  readonly kind: "escape";
  readonly within: "word" | "double-quote" | "ansi-c-quote";
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
  readonly frames: CountedList<Frame>;
  readonly commands: CountedList<SimpleCommand>;
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

const emptyCountedList = <Value>(): CountedList<Value> => ({ items: null, length: 0 });

const appended = <Value>(list: CountedList<Value>, value: Value): CountedList<Value> => ({
  items: { head: value, tail: list.items },
  length: list.length + 1,
});

const newestFirstOf = <Value>({ items, length }: CountedList<Value>): readonly Value[] => {
  let remaining = items;
  return Array.from({ length }, () => {
    const node = remaining;
    remaining = node?.tail ?? null;
    return node;
  }).flatMap((node) => (node === null ? [] : [node.head]));
};

const inInsertionOrder = <Value>(list: CountedList<Value>): readonly Value[] => {
  const newestFirst = newestFirstOf(list);
  return Array.from(
    { length: newestFirst.length },
    (_, index) => newestFirst[newestFirst.length - 1 - index],
  ).flatMap((value) => (value === undefined ? [] : [value]));
};

const commandFrame = ({ closer }: { readonly closer: Closer }): CommandFrame => ({
  kind: "command",
  closer,
  words: emptyCountedList(),
  word: "",
  inWord: false,
});

const topOf = ({ frames }: ScanState): Frame | undefined => frames.items?.head;

const pushed = (state: ScanState, frame: Frame): ScanState => ({
  ...state,
  frames: appended(state.frames, frame),
});

const popped = (state: ScanState): ScanState => ({
  ...state,
  frames: {
    items: state.frames.items?.tail ?? null,
    length: Math.max(0, state.frames.length - 1),
  },
});

const withTop = (state: ScanState, frame: Frame): ScanState =>
  pushed(popped(state), frame);

const skipping = (state: ScanState, skip: number): ScanState => ({ ...state, skip });

type CommandUpdate = {
  readonly frame: CommandFrame;
  readonly completed: SimpleCommand | null;
};

const framesWithNearestCommand = (
  frames: List<Frame>,
  update: (frame: CommandFrame) => CommandUpdate,
): { readonly frames: List<Frame>; readonly completed: SimpleCommand | null } => {
  if (frames === null) return { frames, completed: null };
  if (frames.head.kind === "command") {
    const updated = update(frames.head);
    return { frames: { head: updated.frame, tail: frames.tail }, completed: updated.completed };
  }
  const below = framesWithNearestCommand(frames.tail, update);
  return { frames: { head: frames.head, tail: below.frames }, completed: below.completed };
};

const withNearestCommand = (
  state: ScanState,
  update: (frame: CommandFrame) => CommandUpdate,
): ScanState => {
  const { frames, completed } = framesWithNearestCommand(state.frames.items, update);
  return {
    ...state,
    frames: { items: frames, length: state.frames.length },
    commands: completed === null ? state.commands : appended(state.commands, completed),
  };
};

const appendedToWord = (state: ScanState, text: string): ScanState =>
  withNearestCommand(state, (frame) => ({
    frame: { ...frame, word: frame.word + text, inWord: true },
    completed: null,
  }));

const withWordEnded = (frame: CommandFrame): CommandFrame => ({
  ...frame,
  words: frame.inWord ? appended(frame.words, frame.word) : frame.words,
  word: "",
  inWord: false,
});

const completedCommandOf = (frame: CommandFrame): SimpleCommand | null => {
  const { words } = withWordEnded(frame);
  return words.length > 0 ? inInsertionOrder(words) : null;
};

const wordEnded = (state: ScanState): ScanState =>
  withNearestCommand(state, (frame) => ({ frame: withWordEnded(frame), completed: null }));

const commandEnded = (state: ScanState): ScanState =>
  withNearestCommand(state, (frame) => ({
    frame: { ...withWordEnded(frame), words: emptyCountedList() },
    completed: completedCommandOf(frame),
  }));

const withNextHeredocBody = (state: ScanState): ScanState => {
  const [heredoc, ...remaining] = state.pendingHeredocs;
  if (heredoc === undefined) return state;
  return pushed({ ...state, pendingHeredocs: remaining }, { kind: "heredoc-body", heredoc, line: "" });
};

const isHeredocTerminator = ({ heredoc, line }: HeredocBodyFrame): boolean =>
  (heredoc.stripsTabs ? line.replace(/^\t+/, "") : line).replace(/\r$/, "") ===
  heredoc.delimiter;

const escapedText = ({ within }: EscapeFrame, current: string): string => {
  if (within === "ansi-c-quote") return current;
  if (within === "double-quote")
    return DOUBLE_QUOTE_ESCAPABLE.includes(current) ? current : `\\${current}`;
  return `\\${current}`;
};

const afterEscape = (state: ScanState, frame: EscapeFrame, { current }: Cursor): ScanState => {
  const unescaped = popped(state);
  if (current === "\n" && frame.within !== "ansi-c-quote") return unescaped;
  return appendedToWord(unescaped, escapedText(frame, current));
};

const openedSubstitution = (state: ScanState, { current }: Cursor): ScanState =>
  current === "`"
    ? pushed(state, commandFrame({ closer: "`" }))
    : skipping(pushed(state, commandFrame({ closer: ")" })), 1);

const opensSubstitution = ({ current, next }: Cursor): boolean =>
  current === "`" || (current === "$" && next === "(");

const inDoubleQuotes = (state: ScanState, cursor: Cursor): ScanState => {
  const { current } = cursor;
  if (current === '"') return popped(state);
  if (current === "\\") return pushed(state, { kind: "escape", within: "double-quote" });
  if (opensSubstitution(cursor)) return openedSubstitution(state, cursor);
  return appendedToWord(state, current);
};

const inAnsiCQuotes = (state: ScanState, { current }: Cursor): ScanState => {
  if (current === "'") return popped(state);
  if (current === "\\") return pushed(state, { kind: "escape", within: "ansi-c-quote" });
  return appendedToWord(state, current);
};

const inParameter = (state: ScanState, cursor: Cursor): ScanState => {
  const { current } = cursor;
  if (current === "}") return popped(appendedToWord(state, current));
  if (opensSubstitution(cursor)) return openedSubstitution(state, cursor);
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

const inHeredocBody = (state: ScanState, frame: HeredocBodyFrame, cursor: Cursor): ScanState => {
  const { current, next } = cursor;
  if (current === "\n")
    return isHeredocTerminator(frame)
      ? withNextHeredocBody(popped(state))
      : withTop(state, { ...frame, line: "" });
  if (frame.heredoc.expands && current === "\\")
    return skipping(withTop(state, { ...frame, line: frame.line + current + next }), 1);
  if (frame.heredoc.expands && opensSubstitution(cursor)) return openedSubstitution(state, cursor);
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
  if (current === "\\") return pushed(state, { kind: "escape", within: "word" });
  if (current === "'") return pushed(appendedToWord(state, ""), { kind: "single-quote" });
  if (current === '"') return pushed(appendedToWord(state, ""), { kind: "double-quote" });
  if (current === "$" && next === "'")
    return skipping(pushed(appendedToWord(state, ""), { kind: "ansi-c-quote" }), 1);
  if (current === "$" && next === "{") return pushed(appendedToWord(state, current), { kind: "parameter" });
  if (opensSubstitution(cursor)) return openedSubstitution(appendedToWord(state, ""), cursor);
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
  if (frame === undefined) return state;
  switch (frame.kind) {
    case "escape":
      return afterEscape(state, frame, cursor);
    case "single-quote":
      return current === "'" ? popped(state) : appendedToWord(state, current);
    case "double-quote":
      return inDoubleQuotes(state, cursor);
    case "ansi-c-quote":
      return inAnsiCQuotes(state, cursor);
    case "comment":
      return current === "\n" ? scannedCharacter(popped(state), cursor) : state;
    case "parameter":
      return inParameter(state, cursor);
    case "heredoc-delimiter":
      return inHeredocDelimiter(state, frame, cursor);
    case "heredoc-body":
      return inHeredocBody(state, frame, cursor);
    case "command":
      return inCommand(state, frame, cursor);
  }
};

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
    {
      frames: appended(emptyCountedList<Frame>(), commandFrame({ closer: null })),
      commands: emptyCountedList(),
      pendingHeredocs: [],
      skip: 0,
    },
  );
  const unfinished = inInsertionOrder(scanned.frames).flatMap((frame) => {
    if (frame.kind !== "command") return [];
    const command = completedCommandOf(frame);
    return command === null ? [] : [command];
  });
  return [...inInsertionOrder(scanned.commands), ...unfinished];
};

export type { SimpleCommand };
export { simpleCommandsOf };
