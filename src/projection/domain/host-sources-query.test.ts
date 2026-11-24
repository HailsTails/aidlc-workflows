import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { host, source } from "../../kernel/fixtures/values.fixture.ts";
import { refused } from "../../kernel/result.ts";
import { hostSourcesQuery, sameHostSourcesQuery, type HostSourcesInput } from "./host-sources-query.ts";

const input: HostSourcesInput = { name: "fixture", directory: ".fixture", root: new URL("file:///host"),
  copied: ["first.md", "shared.md", "first.md"], required: ["caller.md", "shared.md"] };

test("query admission retains checked host and first-seen sources with requirements in reading order", () => {
  const query = accept(hostSourcesQuery(input, ["declared.md", "shared.md"]));
  expect(query.host).toEqual(host({ name: "fixture", directory: ".fixture" }));
  expect(query.root).toEqual(input.root);
  expect(query.sources).toEqual([source("first.md"), source("shared.md"), source("caller.md"), source("declared.md")]);
  expect(query.required).toEqual([source("shared.md"), source("caller.md"), source("declared.md")]);
});

test("equality admits duplicate and required-order differences and compares equivalent folder URLs", () => {
  const left = accept(hostSourcesQuery(input, ["declared.md"]));
  const right = accept(hostSourcesQuery({ ...input, root: new URL("file:///host/"),
    copied: ["first.md", "shared.md", "caller.md", "declared.md"],
    required: ["shared.md", "declared.md", "caller.md", "caller.md"] }, []));
  expect(sameHostSourcesQuery(left, right)).toBe(true);
  expect(sameHostSourcesQuery(right, left)).toBe(true);
});

test("host identity, directory and physical folder distinguish otherwise identical queries", () => {
  const query = accept(hostSourcesQuery(input, []));
  expect(sameHostSourcesQuery(query, accept(hostSourcesQuery({ ...input, name: "other" }, [])))).toBe(false);
  expect(sameHostSourcesQuery(query, accept(hostSourcesQuery({ ...input, directory: ".other" }, [])))).toBe(false);
  expect(sameHostSourcesQuery(query, accept(hostSourcesQuery({ ...input, root: new URL("file:///other/") }, []))))
    .toBe(false);
});

test("source order and required membership distinguish queries even with the same file set", () => {
  const query = accept(hostSourcesQuery(input, []));
  expect(sameHostSourcesQuery(query, accept(hostSourcesQuery({ ...input,
    copied: ["shared.md", "first.md"] }, [])))).toBe(false);
  expect(sameHostSourcesQuery(query, accept(hostSourcesQuery({ ...input,
    copied: ["first.md", "shared.md", "caller.md"], required: [] }, [])))).toBe(false);
});

test("a query snapshots mutable input URLs and arrays rather than changing its admitted identity", () => {
  const root = new URL("file:///host");
  const copied = ["first.md"];
  const required = ["first.md"];
  const query = accept(hostSourcesQuery({ ...input, root, copied, required }, []));
  root.pathname = "/changed";
  copied.push("second.md");
  required.push("second.md");
  query.root.pathname = "/also-changed";
  expect(query.root.href).toBe("file:///host");
  expect(query.sources).toEqual([source("first.md")]);
  expect(query.required).toEqual([source("first.md")]);
  expect(sameHostSourcesQuery(query, accept(hostSourcesQuery({ ...input,
    root: new URL("file:///host/"), copied: ["first.md"], required: ["first.md"] }, [])))).toBe(true);
});

test("query admission preserves host-before-directory-before-source refusal precedence", () => {
  expect(hostSourcesQuery({ ...input, name: "BAD", directory: "../bad", copied: ["../source"] }, []))
    .toEqual(refused([{ kind: "invalid-distribution-id", raw: "BAD" }]));
  expect(hostSourcesQuery({ ...input, directory: "../bad", copied: ["../source"] }, []))
    .toEqual(refused([{ kind: "invalid-path", base: "project", raw: "../bad" }]));
  expect(hostSourcesQuery({ ...input, copied: ["../first", "../first"], required: ["../second"] }, ["../third"]))
    .toEqual(refused([
      { kind: "invalid-path", base: "source", raw: "../first" },
      { kind: "invalid-path", base: "source", raw: "../second" },
      { kind: "invalid-path", base: "source", raw: "../third" },
    ]));
});
