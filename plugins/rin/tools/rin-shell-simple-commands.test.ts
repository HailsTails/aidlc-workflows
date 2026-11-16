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
  ])("$source", ({ source, commands }) => {
    expect(simpleCommandsOf({ source })).toStrictEqual(commands);
  });
});
