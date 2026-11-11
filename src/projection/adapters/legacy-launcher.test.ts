import { expect, test } from "bun:test";
import { legacyEngineLauncher } from "./legacy-launcher.ts";

test("the engine launcher sits in the engine's bin folder", () => {
  expect(legacyEngineLauncher.path).toBe(".aidlc/bin/aidlc-engine");
});

test("the engine launcher marks itself and hands every argument to the given invocation's engine route", () => {
  expect(legacyEngineLauncher.body({ invocation: "{{INVOKE}}" })).toBe(
    '#!/bin/sh\nexport AIDLC_ENGINE_LAUNCHER="$0"\nexec {{INVOKE}} engine "$@"\n',
  );
});
