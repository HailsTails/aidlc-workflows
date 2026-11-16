type SimpleCommand = readonly string[];

type PendingHeredoc = {
  readonly delimiter: string;
  readonly stripsTabs: boolean;
  readonly expands: boolean;
};

type Closer = ")" | "`" | null;

const COMMAND_SEPARATORS = new Set([";", "&", "|", "(", ")"]);
const BRACE_GROUP_MARKERS = new Set(["{", "}"]);
const WORD_BOUNDARY = /[\s;&|()<>]/;

const simpleCommandsOf = ({
  source,
}: {
  readonly source: string;
}): readonly SimpleCommand[] => {
  const commands: SimpleCommand[] = [];
  const pendingHeredocs: PendingHeredoc[] = [];
  let cursor = 0;

  const charAt = (offset: number): string => source[cursor + offset] ?? "";

  const lineAt = (start: number): { readonly text: string; readonly end: number } => {
    const newline = source.indexOf("\n", start);
    const end = newline < 0 ? source.length : newline;
    return { text: source.slice(start, end).replace(/\r$/, ""), end };
  };

  const scanSubstitutionsUntil = (end: number): void => {
    while (cursor < end) {
      if (charAt(0) === "\\") {
        cursor += 2;
      } else if (charAt(0) === "$" && charAt(1) === "(") {
        cursor += 2;
        scanSequence(")");
      } else if (charAt(0) === "`") {
        cursor += 1;
        scanSequence("`");
      } else {
        cursor += 1;
      }
    }
  };

  const skipHeredocBody = ({ delimiter, stripsTabs, expands }: PendingHeredoc): void => {
    while (cursor < source.length) {
      const line = lineAt(cursor);
      const candidate = stripsTabs ? line.text.replace(/^\t+/, "") : line.text;
      if (candidate === delimiter) {
        cursor = line.end + 1;
        return;
      }
      if (expands) scanSubstitutionsUntil(line.end);
      cursor = Math.max(cursor, line.end + 1);
    }
  };

  const skipPendingHeredocBodies = (): void => {
    pendingHeredocs.splice(0).forEach((heredoc) => {
      skipHeredocBody(heredoc);
    });
  };

  const readHeredocDelimiter = (): { readonly delimiter: string; readonly quoted: boolean } => {
    while (charAt(0) === " " || charAt(0) === "\t") cursor += 1;
    let delimiter = "";
    let quoted = false;
    while (cursor < source.length && !WORD_BOUNDARY.test(charAt(0))) {
      const quote = charAt(0);
      if (quote === "'" || quote === '"') {
        quoted = true;
        const close = source.indexOf(quote, cursor + 1);
        const end = close < 0 ? source.length : close;
        delimiter += source.slice(cursor + 1, end);
        cursor = end + 1;
      } else if (quote === "\\") {
        quoted = true;
        delimiter += charAt(1);
        cursor += 2;
      } else {
        delimiter += quote;
        cursor += 1;
      }
    }
    return { delimiter, quoted };
  };

  const readSingleQuoted = (): string => {
    const close = source.indexOf("'", cursor + 1);
    const end = close < 0 ? source.length : close;
    const text = source.slice(cursor + 1, end);
    cursor = end + 1;
    return text;
  };

  const readDoubleQuoted = (): string => {
    cursor += 1;
    let text = "";
    while (cursor < source.length && charAt(0) !== '"') {
      if (charAt(0) === "\\") {
        text += '"\\$`\n'.includes(charAt(1)) ? charAt(1) : `\\${charAt(1)}`;
        cursor += 2;
      } else if (charAt(0) === "$" && charAt(1) === "(") {
        cursor += 2;
        scanSequence(")");
      } else if (charAt(0) === "`") {
        cursor += 1;
        scanSequence("`");
      } else {
        text += charAt(0);
        cursor += 1;
      }
    }
    cursor += 1;
    return text;
  };

  const readParameterExpansion = (): string => {
    const close = source.indexOf("}", cursor);
    const end = close < 0 ? source.length : close;
    const text = source.slice(cursor, end + 1);
    cursor = end + 1;
    return text;
  };

  const scanSequence = (closer: Closer): void => {
    let words: string[] = [];
    let word = "";
    let inWord = false;

    const endWord = (): void => {
      if (inWord) words.push(word);
      word = "";
      inWord = false;
    };

    const endCommand = (): void => {
      endWord();
      if (words.length > 0) commands.push(words);
      words = [];
    };

    while (cursor < source.length) {
      const current = charAt(0);
      if (closer !== null && current === closer) {
        cursor += 1;
        endCommand();
        return;
      }
      if (current === "\n") {
        cursor += 1;
        endCommand();
        skipPendingHeredocBodies();
      } else if (current === "\\") {
        if (charAt(1) === "\n") {
          cursor += 2;
        } else {
          word += `\\${charAt(1)}`;
          inWord = true;
          cursor += 2;
        }
      } else if (current === "'") {
        word += readSingleQuoted();
        inWord = true;
      } else if (current === '"') {
        word += readDoubleQuoted();
        inWord = true;
      } else if (current === "$" && charAt(1) === "(") {
        cursor += 2;
        scanSequence(")");
        inWord = true;
      } else if (current === "$" && charAt(1) === "{") {
        word += readParameterExpansion();
        inWord = true;
      } else if (current === "`") {
        cursor += 1;
        scanSequence("`");
        inWord = true;
      } else if (current === "<" && charAt(1) === "<" && charAt(2) !== "<") {
        endWord();
        cursor += 2;
        const stripsTabs = charAt(0) === "-";
        if (stripsTabs) cursor += 1;
        const { delimiter, quoted } = readHeredocDelimiter();
        pendingHeredocs.push({ delimiter, stripsTabs, expands: !quoted });
      } else if (current === "#" && !inWord) {
        cursor = lineAt(cursor).end;
      } else if (COMMAND_SEPARATORS.has(current)) {
        cursor += 1;
        endCommand();
      } else if (BRACE_GROUP_MARKERS.has(current) && !inWord) {
        cursor += 1;
        endCommand();
      } else if (/\s/.test(current)) {
        cursor += 1;
        endWord();
      } else {
        word += current;
        inWord = true;
        cursor += 1;
      }
    }
    endCommand();
  };

  while (cursor < source.length) scanSequence(null);
  return commands;
};

export type { SimpleCommand };
export { simpleCommandsOf };
