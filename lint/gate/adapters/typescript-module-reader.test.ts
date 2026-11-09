import { describe, expect, test } from "bun:test";
import { typescriptModuleReader } from "./typescript-module-reader.ts";

const TEXT = [
  "export type EmitContext = {",
  "  emitCommands: (place: string) => void;",
  "  readonly repoRoot: string;",
  "};",
  "export interface Other { alpha: string }",
  "export type Joined = { first: string } & { second: string };",
].join("\n");

const membersOf = (type: string): readonly string[] =>
  typescriptModuleReader.membersOf({ path: "x.ts", text: TEXT, type });

describe("typescriptModuleReader.membersOf", () => {
  test("it lists the members of a type alias literal", () => {
    expect(membersOf("EmitContext")).toEqual(["emitCommands", "repoRoot"]);
  });

  test("it lists the members of an interface", () => {
    expect(membersOf("Other")).toEqual(["alpha"]);
  });

  test("it lists the members of every literal in an intersection", () => {
    expect(membersOf("Joined")).toEqual(["first", "second"]);
  });

  test("a type that is not declared has no members", () => {
    expect(membersOf("Missing")).toEqual([]);
  });
});
