import { expect, test } from "bun:test";
import { kiroKnowledgeReading } from "./knowledge-reading.ts";

test("Kiro CLI helpers read knowledge in parts, guided by the shipped runtime's own Kiro preflight clause", () => {
  expect(kiroKnowledgeReading(".kiro")).toEqual({
    kind: "in-parts",
    guide: "To find them, list each of these folders with your file tool, one folder per call, and any "
      + "folder inside one the same way; a folder that is not there has nothing to load, and a shell line that "
      + "lists, searches or reads them can stop and ask the person to approve it. Kiro shows only part of a long "
      + "file: read each one with your file tool in parts of at most 200 lines (offset and limit), from the "
      + "first line to the last; a read that comes back cut short is not all of it. ",
  });
});
