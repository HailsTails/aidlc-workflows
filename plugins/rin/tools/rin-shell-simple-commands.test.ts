import { describe, expect, test } from "vitest";
import { simpleCommandsOf } from "./rin-shell-simple-commands.ts";

describe("simpleCommandsOf splits a shell line into the commands it would run", () => {
  test.each([
    { source: "git status", commands: [["git", "status"]] },
    { source: "a && b || c; d | e & f", commands: [["a"], ["b"], ["c"], ["d"], ["e"], ["f"]] },
    { source: "a\nb", commands: [["a"], ["b"]] },
    { source: "(a b)", commands: [["a", "b"]] },
    { source: "{ a; }", commands: [["a"]] },
    { source: "echo $(a b)", commands: [["a", "b"], ["echo", ""]] },
    { source: "echo `a b`", commands: [["a", "b"], ["echo", ""]] },
    { source: 'echo "x $(a b) y"', commands: [["a", "b"], ["echo", "x  y"]] },
  ])("$source", ({ source, commands }) => {
    expect(simpleCommandsOf({ source })).toStrictEqual(commands);
  });
});

describe("simpleCommandsOf keeps quoted and heredoc text as data", () => {
  test.each([
    { source: 'git commit -m "a; b (c) | d"', commands: [["git", "commit", "-m", "a; b (c) | d"]] },
    { source: "rg 'a|b' src", commands: [["rg", "a|b", "src"]] },
    { source: "echo '$(a)'", commands: [["echo", "$(a)"]] },
    { source: "FOO='a b' c", commands: [["FOO=a b", "c"]] },
    { source: `echo \${HOME}/x`, commands: [["echo", `\${HOME}/x`]] },
    { source: "a # b; c", commands: [["a"]] },
    { source: "cat <<'EOF' > f\nb; c\n(d)\nEOF\ne", commands: [["cat", ">", "f"], ["e"]] },
    { source: "cat <<-EOF\n\tb\n\tEOF\ne", commands: [["cat"], ["e"]] },
    { source: "cat <<EOF\n$(a b)\nEOF", commands: [["cat"], ["a", "b"]] },
    {
      source: "git commit -m \"$(cat <<'EOF'\nfix\n(npx b)\nEOF\n)\"",
      commands: [["cat"], ["git", "commit", "-m", ""]],
    },
    { source: "a \\; b", commands: [["a", "\\;", "b"]] },
    { source: '"C:\\Program Files\\x.cmd" y', commands: [["C:\\Program Files\\x.cmd", "y"]] },
    { source: "cat <<A <<'B'\nnpx a\nA\nnpx b\nB\nnext", commands: [["cat"], ["next"]] },
    { source: 'cat <<< "npx pkg"', commands: [["cat", "<<<", "npx pkg"]] },
    { source: "cat <<EOF\r\nnpx a\r\nEOF\r\nb", commands: [["cat"], ["b"]] },
    { source: "echo $'it\\'s; npx'", commands: [["echo", "it's; npx"]] },
  ])("$source", ({ source, commands }) => {
    expect(simpleCommandsOf({ source })).toStrictEqual(commands);
  });
});

describe("simpleCommandsOf finds commands the shell runs from inside expansions and quoting", () => {
  test.each([
    { source: "a b\r\nc", commands: [["a", "b"], ["c"]] },
    { source: "np\\\nx pkg", commands: [["npx", "pkg"]] },
    { source: "echo $'it\\'s'; npx pkg", commands: [["echo", "it's"], ["npx", "pkg"]] },
    { source: `echo \${X:-$(npx pkg)}`, commands: [["npx", "pkg"], ["echo", `\${X:-}`]] },
    { source: `echo \${X:-\`npx pkg\`}`, commands: [["npx", "pkg"], ["echo", `\${X:-}`]] },
  ])("$source", ({ source, commands }) => {
    expect(simpleCommandsOf({ source })).toStrictEqual(commands);
  });
});

describe("simpleCommandsOf scans in time linear in the line's length", () => {
  const MEGABYTE_OF_INPUT = 1_000_000;
  const BUDGET_MILLISECONDS = 5_000;

  const elapsedMillisecondsScanning = ({ source }: { readonly source: string }): number => {
    const started = performance.now();
    simpleCommandsOf({ source });
    return performance.now() - started;
  };

  test.each([
    { shape: "many short commands", source: "a;".repeat(MEGABYTE_OF_INPUT / 2) },
    { shape: "one command with many words", source: "a ".repeat(MEGABYTE_OF_INPUT / 2) },
    { shape: "one long word", source: "a".repeat(MEGABYTE_OF_INPUT) },
    { shape: "a long heredoc", source: `cat <<'EOF'\n${"npx; (a)\n".repeat(MEGABYTE_OF_INPUT / 10)}EOF\n` },
    { shape: "a long double-quoted message", source: `git commit -m "${"a; (b) | c ".repeat(MEGABYTE_OF_INPUT / 12)}"` },
  ])("a megabyte of $shape scans within the budget", ({ source }) => {
    expect(elapsedMillisecondsScanning({ source })).toBeLessThan(BUDGET_MILLISECONDS);
  }, 120_000);
});
