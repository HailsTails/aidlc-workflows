import * as ts from "typescript";
import type { TestReach } from "../domain/test-impact.ts";
import type { Workspace } from "../application/ports.ts";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"] as const;

const JOINING_CALLS = new Set(["join", "resolve", "pathToFileURL"]);

type Edge = { readonly kind: "file" | "folder"; readonly path: string };

type Literal = { readonly text: string; readonly joined: boolean };

const directoryOf = (path: string): string => path.split("/").slice(0, -1).join("/");

const normalise = (path: string): string => {
  const kept: string[] = [];
  for (const part of path.split("/")) {
    if (part === "..") {
      kept.pop();
    } else if (part !== "." && part !== "") {
      kept.push(part);
    }
  }
  return kept.join("/");
};

const isJoining = (call: ts.CallExpression): boolean =>
  JOINING_CALLS.has(call.expression.getText());

const joinedLiteral = (call: ts.CallExpression): readonly Literal[] => {
  const parts = call.arguments.filter(ts.isStringLiteralLike).map((part) => part.text);
  return isJoining(call) ? [{ text: parts.join("/"), joined: true }] : [];
};

const ownLiteral = (node: ts.Node): readonly Literal[] => {
  if (ts.isStringLiteralLike(node)) {
    return [{ text: node.text, joined: false }];
  }
  return ts.isCallExpression(node) ? joinedLiteral(node) : [];
};

const literalsOf = (node: ts.Node): readonly Literal[] => [
  ...ownLiteral(node),
  ...node.getChildren().flatMap(literalsOf),
];

const candidatesFor = (literal: string, from: string): readonly string[] => {
  const relative = literal.startsWith(".") ? normalise(`${directoryOf(from)}/${literal}`) : literal;
  return [
    relative,
    ...SOURCE_EXTENSIONS.map((extension) => `${relative}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => `${relative}/index${extension}`),
  ];
};

const isPathLike = (literal: string): boolean =>
  literal.length > 0 && !literal.includes(" ") && !literal.startsWith("node:");

const resolveEdge = (workspace: Workspace, found: Literal, from: string): Edge | undefined => {
  if (!isPathLike(found.text)) {
    return undefined;
  }
  const file = candidatesFor(found.text, from).find((path) => workspace.read(path) !== undefined);
  if (file !== undefined) {
    return { kind: "file", path: file };
  }
  const folder = normalise(found.text);
  const namesFolder = found.text.includes("/") || found.joined;
  return namesFolder && workspace.filesMatching([`${folder}/**`]).length > 0
    ? { kind: "folder", path: folder }
    : undefined;
};

const edgesIn = (workspace: Workspace, path: string): readonly Edge[] => {
  const text = workspace.read(path);
  if (text === undefined || !SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension))) {
    return [];
  }
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  return literalsOf(source).flatMap((found) => resolveEdge(workspace, found, path) ?? []);
};

const reachFrom = (edgesOf: (path: string) => readonly Edge[], test: string): readonly string[] => {
  const seen = new Set<string>([test]);
  const folders = new Set<string>();
  const queue = [test];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const edge of edgesOf(next)) {
      if (edge.kind === "folder") {
        folders.add(`${edge.path}/**`);
      } else if (!seen.has(edge.path)) {
        seen.add(edge.path);
        queue.push(edge.path);
      }
    }
  }
  return [...seen, ...folders];
};

export const testReach = (request: {
  readonly workspace: Workspace;
  readonly tests: readonly string[];
}): TestReach => {
  const cache = new Map<string, readonly Edge[]>();
  const edgesOf = (path: string): readonly Edge[] => {
    const known = cache.get(path) ?? edgesIn(request.workspace, path);
    cache.set(path, known);
    return known;
  };
  return Object.fromEntries(request.tests.map((test) => [test, reachFrom(edgesOf, test)]));
};
