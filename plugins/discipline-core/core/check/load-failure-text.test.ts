import { describe, expect, it } from "vitest";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import { loadFailureText } from "./load-failure-text.ts";

const WALKER = mechanismIdSchema.parse("audit");

describe("loadFailureText", () => {
  it("prints one line naming the kind and its detail", () => {
    expect(loadFailureText({ failure: { kind: "git-failed", detail: "git ls-files: not a git repository" } })).toBe(
      "load failure: git-failed git ls-files: not a git repository\n",
    );
  });

  it("prints a file failure's path then its detail", () => {
    expect(
      loadFailureText({ failure: { kind: "file-unreadable", path: "/repo/disciplines.json", detail: "EACCES" } }),
    ).toBe("load failure: file-unreadable /repo/disciplines.json EACCES\n");
  });

  it("prints a mechanism-not-allowed failure's address then its mechanism", () => {
    expect(
      loadFailureText({ failure: { kind: "mechanism-not-allowed", address: "CD-14#class-syntax", mechanism: WALKER } }),
    ).toBe("load failure: mechanism-not-allowed CD-14#class-syntax audit\n");
  });

  it("prints runner-missing with its mechanism", () => {
    expect(loadFailureText({ failure: { kind: "runner-missing", mechanism: WALKER } })).toBe(
      "load failure: runner-missing audit\n",
    );
  });

  it("prints the found version of an unsupported version as JSON", () => {
    expect(
      loadFailureText({ failure: { kind: "unsupported-version", path: "/repo/disciplines.json", found: "1" } }),
    ).toBe('load failure: unsupported-version /repo/disciplines.json "1"\n');
  });

  it("prints runner-failed with its mechanism and the runner failure's kind and fields", () => {
    expect(
      loadFailureText({
        failure: {
          kind: "runner-failed",
          mechanism: WALKER,
          failure: { kind: "file-unparseable", file: repoPathSchema.parse("src/a.ts"), detail: "unexpected token" },
        },
      }),
    ).toBe("load failure: runner-failed audit file-unparseable src/a.ts unexpected token\n");
  });

  it("escapes a line feed and a carriage return in a git-failed detail", () => {
    expect(
      loadFailureText({ failure: { kind: "git-failed", detail: "refused path src/a\nb.ts\rverdict: pass" } }),
    ).toBe("load failure: git-failed refused path src/a\\nb.ts\\rverdict: pass\n");
  });

  it("escapes a line feed in a path field", () => {
    expect(
      loadFailureText({ failure: { kind: "file-malformed", path: "/repo/a\nverdict: pass", detail: "Unexpected end" } }),
    ).toBe("load failure: file-malformed /repo/a\\nverdict: pass Unexpected end\n");
  });

  it("escapes a line feed in an install root URL", () => {
    expect(
      loadFailureText({
        failure: { kind: "install-root-unresolvable", url: "https://x/\nverdict: pass", detail: "not a file: URL" },
      }),
    ).toBe("load failure: install-root-unresolvable https://x/\\nverdict: pass not a file: URL\n");
  });

  it("escapes a line feed in a nested runner failure's detail", () => {
    expect(
      loadFailureText({
        failure: { kind: "runner-failed", mechanism: WALKER, failure: { kind: "tool-failed", detail: "crashed\nverdict: pass" } },
      }),
    ).toBe("load failure: runner-failed audit tool-failed crashed\\nverdict: pass\n");
  });
});
