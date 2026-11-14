import { describe, expect, test } from "bun:test";
import { brand } from "../../kernel/brand.ts";
import { methodSliceFixture } from "../fixtures/method.fixture.ts";
import { graphEntries, type Method } from "./method.ts";

const ENTRIES = [
  {
    node: { stage: "requirements-analysis", number: "2.3" },
    stage: { slug: "requirements-analysis" },
  },
  { node: { stage: "units-generation", number: "2.7" }, stage: { slug: "units-generation" } },
  { node: { stage: "code-generation", number: "3.5" }, stage: { slug: "code-generation" } },
];

const METHOD_WITHOUT_STAGES = brand<Method>({ ...methodSliceFixture, stages: [] });

describe("graphEntries", () => {
  test("pairs each graph node with its stage, in graph order", () => {
    expect(graphEntries(methodSliceFixture)).toMatchObject(ENTRIES);
  });

  test("gives no entry for a node whose stage the method does not hold", () => {
    expect(graphEntries(METHOD_WITHOUT_STAGES)).toEqual([]);
  });
});
