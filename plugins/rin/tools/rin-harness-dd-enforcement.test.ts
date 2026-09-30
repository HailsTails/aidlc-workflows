import { join, resolve, sep } from "node:path";
import { describe, expect, test } from "vitest";
import { recordDirectoryFor } from "./rin-harness-dd-enforcement.ts";

const INTENT_ARTEFACT = join(
  "aidlc",
  "spaces",
  "default",
  "intents",
  "260906-example-record",
  "rin-requirements.md",
);

describe("record resolution — the paths that decide corpus-wide safety", () => {
  test("an artefact inside a record resolves to that record's directory", () => {
    const resolved = recordDirectoryFor({ outputPath: INTENT_ARTEFACT });
    expect(resolved).toBe(
      resolve(
        join("aidlc", "spaces", "default", "intents", "260906-example-record"),
      ),
    );
  });

  test("an artefact nested under a phase directory resolves to the RECORD, not the phase", () => {
    const nested = join(
      "aidlc",
      "spaces",
      "default",
      "intents",
      "260906-example-record",
      "inception",
      "rin-gate-1-framing",
      "rin-requirements.md",
    );
    expect(recordDirectoryFor({ outputPath: nested })).toBe(
      resolve(
        join("aidlc", "spaces", "default", "intents", "260906-example-record"),
      ),
    );
  });

  test("a path outside any intent record resolves to nothing", () => {
    expect(
      recordDirectoryFor({
        outputPath: join("packages", "kernel", "src", "index.ts"),
      }),
    ).toBeUndefined();
  });

  test("a path whose only 'intents' mention is a filename does not resolve", () => {
    expect(
      recordDirectoryFor({ outputPath: join("docs", "intents.md") }),
    ).toBeUndefined();
  });

  test("the resolved directory is the segment immediately after intents", () => {
    const resolved = recordDirectoryFor({ outputPath: INTENT_ARTEFACT });
    expect(resolved?.split(sep).pop()).toBe("260906-example-record");
  });
});
