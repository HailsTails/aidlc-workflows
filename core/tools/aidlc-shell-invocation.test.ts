// covers: function:parseLiteralShellInvocation, function:shellCommandSegments
import { expect, test } from "bun:test";
import { parseLiteralShellInvocation, shellCommandSegments } from "./aidlc-shell-invocation.ts";

type InvocationCase = {
  name: string;
  text: string;
  expected: { directory: string | null; command: string; argv: string[]; rawWords: string[] };
};

const INVOCATIONS: InvocationCase[] = [
  { name: "plain command", text: "aidlc next", expected: { directory: null, command: "aidlc next", argv: ["aidlc", "next"], rawWords: ["aidlc", "next"] } },
  { name: "ASCII edge whitespace only", text: " \taidlc\t next \t", expected: { directory: null, command: "aidlc\t next", argv: ["aidlc", "next"], rawWords: ["aidlc", "next"] } },
  { name: "stderr merge suffix", text: "aidlc next \t2>&1 \t", expected: { directory: null, command: "aidlc next", argv: ["aidlc", "next"], rawWords: ["aidlc", "next"] } },
  { name: "quoted suffix is a word", text: "echo '2>&1'", expected: { directory: null, command: "echo '2>&1'", argv: ["echo", "2>&1"], rawWords: ["echo", "'2>&1'"] } },
  { name: "empty command word", text: "''", expected: { directory: null, command: "''", argv: [""], rawWords: ["''"] } },
  { name: "empty arguments", text: "echo '' \"\"", expected: { directory: null, command: "echo '' \"\"", argv: ["echo", "", ""], rawWords: ["echo", "''", "\"\""] } },
  { name: "adjacent quote fragments", text: "a' b'\"c\"d", expected: { directory: null, command: "a' b'\"c\"d", argv: ["a bcd"], rawWords: ["a' b'\"c\"d"] } },
  { name: "quoted operators are data", text: "echo 'a && b | c; # $x'", expected: { directory: null, command: "echo 'a && b | c; # $x'", argv: ["echo", "a && b | c; # $x"], rawWords: ["echo", "'a && b | c; # $x'"] } },
  { name: "double quoted apostrophe", text: "echo \"it's\"", expected: { directory: null, command: "echo \"it's\"", argv: ["echo", "it's"], rawWords: ["echo", "\"it's\""] } },
  { name: "double quoted escape subset", text: String.raw`echo "a\"b\\c\$d\qe"`, expected: { directory: null, command: String.raw`echo "a\"b\\c\$d\qe"`, argv: ["echo", 'a"b\\c$d\\qe'], rawWords: ["echo", String.raw`"a\"b\\c\$d\qe"`] } },
  { name: "single quoted backslash stays literal", text: String.raw`echo 'a\$b'`, expected: { directory: null, command: String.raw`echo 'a\$b'`, argv: ["echo", String.raw`a\$b`], rawWords: ["echo", String.raw`'a\$b'`] } },
  { name: "tilde after empty quotes", text: "echo ''~ a~ '~'", expected: { directory: null, command: "echo ''~ a~ '~'", argv: ["echo", "~", "a~", "~"], rawWords: ["echo", "''~", "a~", "'~'"] } },
  { name: "nonbreaking space is not shell whitespace", text: "aidlc\u00a0next --depth\u00a0standard", expected: { directory: null, command: "aidlc\u00a0next --depth\u00a0standard", argv: ["aidlc\u00a0next", "--depth\u00a0standard"], rawWords: ["aidlc\u00a0next", "--depth\u00a0standard"] } },
  { name: "vertical tab and form feed are literal", text: "a\vb\fc", expected: { directory: null, command: "a\vb\fc", argv: ["a\vb\fc"], rawWords: ["a\vb\fc"] } },
  { name: "unicode separators are literal", text: "a\u2028b\u2029c", expected: { directory: null, command: "a\u2028b\u2029c", argv: ["a\u2028b\u2029c"], rawWords: ["a\u2028b\u2029c"] } },
  { name: "astral and lone surrogate offsets", text: "\ud83d\ude80 '\ud800' \udc00", expected: { directory: null, command: "\ud83d\ude80 '\ud800' \udc00", argv: ["\ud83d\ude80", "\ud800", "\udc00"], rawWords: ["\ud83d\ude80", "'\ud800'", "\udc00"] } },
  { name: "absolute cd prelude", text: "cd /workspace && aidlc next", expected: { directory: "/workspace", command: "aidlc next", argv: ["aidlc", "next"], rawWords: ["aidlc", "next"] } },
  { name: "unspaced operator and raw command", text: "cd '/a b'&&\t'cmd'  \"arg\" 2>&1", expected: { directory: "/a b", command: "'cmd'  \"arg\"", argv: ["cmd", "arg"], rawWords: ["'cmd'", "\"arg\""] } },
  { name: "raw option delimiter", text: "cd -- / && ''", expected: { directory: "/", command: "''", argv: [""], rawWords: ["''"] } },
  { name: "drive slash root", text: "cd z:/app && aidlc", expected: { directory: "z:/app", command: "aidlc", argv: ["aidlc"], rawWords: ["aidlc"] } },
  { name: "native Windows quoted path", text: String.raw`cd "C:\Windows\Temp\project" && aidlc next`, expected: { directory: String.raw`C:\Windows\Temp\project`, command: "aidlc next", argv: ["aidlc", "next"], rawWords: ["aidlc", "next"] } },
  { name: "UNC root", text: String.raw`cd '\\server\share\folder' && aidlc`, expected: { directory: String.raw`\\server\share\folder`, command: "aidlc", argv: ["aidlc"], rawWords: ["aidlc"] } },
  { name: "UNC mixed separator", text: String.raw`cd '\\server/share' && aidlc`, expected: { directory: String.raw`\\server/share`, command: "aidlc", argv: ["aidlc"], rawWords: ["aidlc"] } },
  { name: "cd alone is ordinary command", text: "cd relative extra", expected: { directory: null, command: "cd relative extra", argv: ["cd", "relative", "extra"], rawWords: ["cd", "relative", "extra"] } },
];

const REJECTIONS: [string, string][] = [
  ["empty", ""], ["whitespace", " \t"], ["NUL", "echo 'a\0b'"], ["CR", "echo 'a\rb'"],
  ["LF", "echo 'a\nb'"], ["continued word", "ai\\\ndlc next"],
  ["single quoted substitution is rejected globally", "echo '$(x)'"], ["backtick rejected globally", "echo '`x`'"],
  ["escaped backtick rejected globally", 'echo "\\`"'],
  ["double quoted expansion", 'echo "$HOME"'], ["unquoted expansion", "echo $HOME"],
  ["unquoted backslash", String.raw`echo a\b`], ["unquoted Windows path", String.raw`cd C:\app && aidlc`],
  ["tilde first", "echo ~"], ["tilde before quote", "echo ~'x'"],
  ["single quote open", "echo 'a"], ["double quote open", 'echo "a'],
  ["escaped closing quote", String.raw`echo "a\"`], ["trailing double backslash", 'echo "a\\'],
  ["single ampersand", "a & b"], ["pipe", "a | b"], ["or", "a || b"], ["semicolon", "a;b"],
  ["redirect output", "a > b"], ["redirect input", "a < b"], ["glob", "a*"], ["question glob", "a?"],
  ["bracket", "a[b]"], ["brace", "a{b}"], ["subshell", "(a)"], ["comment marker", "a#b"],
  ["merge suffix alone", "2>&1"], ["merge with no boundary", "a2>&1"], ["two merge suffixes", "a 2>&1 2>&1"],
  ["nonliteral prefix", "echo /app && aidlc"], ["quoted cd", "'cd' /app && aidlc"],
  ["assembled cd", "c''d /app && aidlc"], ["quoted option delimiter", "cd '--' /app && aidlc"],
  ["missing directory", "cd && aidlc"], ["excess prefix", "cd /a /b && aidlc"],
  ["relative directory", "cd relative && aidlc"], ["drive relative", "cd C:app && aidlc"],
  ["UNC without share", String.raw`cd '\\server' && aidlc`],
  ["empty directory", "cd '' && aidlc"], ["missing command", "cd /app &&"],
  ["empty prefix", "&& aidlc"], ["multiple and", "cd /app && aidlc && next"],
  ["adjacent and", "cd /app &&&& aidlc"], ["operator tail ampersand", "cd /app &&& aidlc"],
  ["missing command after merge removal", "cd /app && 2>&1"],
];

const SEGMENTS = [
  { name: "empty segment", text: "", expected: [""] },
  { name: "raw whitespace", text: " a \t", expected: [" a \t"] },
  { name: "all separators", text: "a&&b|c;d\ne", expected: ["a", "b", "c", "d", "e"] },
  { name: "or keeps empty middle", text: "a||b", expected: ["a", "", "b"] },
  { name: "leading and trailing", text: "&&a;", expected: ["", "a", ""] },
  { name: "adjacent and", text: "&&&&", expected: ["", "", ""] },
  { name: "odd ampersand", text: "a&&&b&", expected: ["a", "&b&"] },
  { name: "single quoted operators", text: "'a&&b;c|d\ne'&&f", expected: ["'a&&b;c|d\ne'", "f"] },
  { name: "double quoted operators", text: '"a&&b;c|d\ne"&&f', expected: ['"a&&b;c|d\ne"', "f"] },
  { name: "mixed quote fragments", text: "a'b;'\"c|\";d", expected: ["a'b;'\"c|\"", "d"] },
  { name: "escaped semicolon", text: String.raw`a\;b;c`, expected: [String.raw`a\;b`, "c"] },
  { name: "escaped ampersand", text: String.raw`a\&&b&&c`, expected: [String.raw`a\&&b`, "c"] },
  { name: "escaped first pipe", text: String.raw`a\||b`, expected: [String.raw`a\|`, "b"] },
  { name: "escaped backslash", text: String.raw`a\\;b`, expected: [String.raw`a\\`, "b"] },
  { name: "escaped quote", text: String.raw`a\";b`, expected: [String.raw`a\"`, "b"] },
  { name: "double quoted escape", text: String.raw`"a\";b";c`, expected: [String.raw`"a\";b"`, "c"] },
  { name: "single quote ignores backslash", text: String.raw`'a\';b`, expected: [String.raw`'a\'`, "b"] },
  { name: "unmatched single quote", text: "a;'b;c", expected: ["a", "'b;c"] },
  { name: "unmatched double quote", text: 'a;"b;c', expected: ["a", '"b;c'] },
  { name: "trailing escape", text: "a;b\\", expected: ["a", "b\\"] },
  { name: "CR is retained", text: "a\r\nb", expected: ["a\r", "b"] },
  { name: "escaped LF retained", text: "a\\\nb;c", expected: ["a\\\nb", "c"] },
  { name: "substitution is not expanded", text: "$(a;b);c", expected: ["$(a", "b)", "c"] },
  { name: "backticks do not quote", text: "`a;b`;c", expected: ["`a", "b`", "c"] },
  { name: "NUL and unicode stay raw", text: "\ud800\0\ud83d\ude80;\udc00\u2028x", expected: ["\ud800\0\ud83d\ude80", "\udc00\u2028x"] },
];

test.each(INVOCATIONS)("literal shell invocation: $name", ({ text, expected }) => {
  expect(parseLiteralShellInvocation(text)).toEqual(expected);
});

test.each(REJECTIONS)("rejects %s", (name, text) => {
  expect(parseLiteralShellInvocation(text), name).toBeNull();
});

test.each(SEGMENTS)("shell segments: $name", ({ text, expected }) => {
  expect(shellCommandSegments(text)).toEqual(expected);
});
