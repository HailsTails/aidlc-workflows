import { describe, expect, test } from "bun:test";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import {
  authoredHookRegistrationFixture,
  authoredSettingsFileFixture,
  COPY_CHANNEL_ALLOWS_FIXTURE,
  RUNTIME_ENTRYPOINTS_FIXTURE,
  settingsRenderingInputsFixture,
} from "./settings-rendering.fixture.ts";
import { tokenBindingsFixture } from "./token-bindings.fixture.ts";
import { text } from "./values.fixture.ts";

const files = [authoredSettingsFileFixture, authoredHookRegistrationFixture];
const inputs = settingsRenderingInputsFixture({ harnessDir: ".cursor", files });

describe("authored settings fixtures", () => {
  test("carry the copy-channel allow glob a host expands", () => {
    expect(authoredSettingsFileFixture).toMatchObject({
      source: source("settings.json"),
      content: { kind: "text", text: expect.stringContaining('"Bash(bun {{HARNESS_DIR}}/tools/aidlc-*)"') },
    });
  });

  test("carry a hook registration with a token in its command", () => {
    expect(authoredHookRegistrationFixture).toMatchObject({
      source: source("hooks.json"),
      content: { kind: "text", text: expect.stringContaining("{{INVOKE}} engine adapter host session-start") },
    });
  });
});

describe("settingsRenderingInputsFixture", () => {
  test("offers the files it is given with the fixed allows, entrypoints and tokens", () => {
    expect(inputs).toMatchObject({
      files,
      tokens: tokenBindingsFixture({ harnessDir: ".cursor" }),
      allows: COPY_CHANNEL_ALLOWS_FIXTURE,
      entrypoints: RUNTIME_ENTRYPOINTS_FIXTURE,
    });
  });

  test("prepares an authored file unchanged", () => {
    const authored = { source: source("cli.json"), content: text(["{}"]) };

    expect(inputs.prepare(authored)).toEqual({ ok: true, value: authored });
  });
});
