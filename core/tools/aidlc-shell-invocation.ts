// Literal shell syntax only. Never execute or expand a word to inspect a command.
export function parseLiteralShellInvocation(text: string, windowsPaths = false): {
  directory: string | null;
  command: string;
  argv: string[];
  rawWords: string[];
} | null {
  if (/[\0\r\n]|\$\(|`/.test(text)) return null;
  text = text.replace(/^[ \t]+|[ \t]+$/g, "").replace(/[ \t]+2>&1$/, "");
  const tokens: Array<{ value: string; raw: string; start: number; and: boolean }> = [];
  for (let i = 0; i < text.length;) {
    if (text[i] === " " || text[i] === "\t") { i++; continue; }
    if (text.slice(i, i + 2) === "&&") {
      tokens.push({ value: "&&", raw: "&&", start: i, and: true });
      i += 2;
      continue;
    }
    const start = i;
    let value = "";
    let quote: "'" | '"' | null = null;
    while (i < text.length) {
      const ch = text[i];
      if (quote === "'") {
        if (ch === "'") quote = null;
        else value += ch;
        i++;
      } else if (quote === '"') {
        if (ch === '"') { quote = null; i++; }
        else if (ch === "$") return null;
        else if (ch === "\\" && /["\\$`]/.test(text[i + 1] ?? "")) {
          value += text[i + 1];
          i += 2;
        } else { value += ch; i++; }
      } else {
        if (ch === " " || ch === "\t" || text.slice(i, i + 2) === "&&") break;
        if (ch === "'" || ch === '"') { quote = ch; i++; }
        else if ((!windowsPaths && ch === "\\") || "()[]{}*?;|<>&$#".includes(ch) || (ch === "~" && i === start)) return null;
        else { value += ch; i++; }
      }
    }
    if (quote !== null) return null;
    tokens.push({ value, raw: text.slice(start, i), start, and: false });
  }
  const separators = tokens.flatMap((token, i) => token.and ? [i] : []);
  let directory: string | null = null;
  let words = tokens;
  if (separators.length > 0) {
    if (separators.length !== 1) return null;
    const at = separators[0];
    const prefix = tokens.slice(0, at);
    if (
      prefix[0]?.raw !== "cd" ||
      !(prefix.length === 2 || (prefix.length === 3 && prefix[1].raw === "--"))
    ) return null;
    directory = prefix.at(-1)!.value;
    if (
      !directory.startsWith("/") &&
      !/^[A-Za-z]:[/\\]/.test(directory) &&
      !/^\\\\[^/\\]+[/\\][^/\\]+/.test(directory)
    ) return null;
    words = tokens.slice(at + 1);
  }
  if (words.length === 0 || words.some((word) => word.and)) return null;
  return {
    directory,
    command: text.slice(words[0].start),
    argv: words.map((word) => word.value),
    rawWords: words.map((word) => word.raw),
  };
}

export function shellCommandSegments(command: string, background = false): string[] {
  const segments: string[] = [];
  let start = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    const separatorWidth =
      char === "&" && command[i + 1] === "&"
        ? 2
        : char === "|" || char === ";" || char === "\n" || (background && char === "&") ? 1 : 0;
    if (separatorWidth === 0) continue;
    segments.push(command.slice(start, i));
    i += separatorWidth - 1;
    start = i + 1;
  }

  segments.push(command.slice(start));
  return segments;
}
