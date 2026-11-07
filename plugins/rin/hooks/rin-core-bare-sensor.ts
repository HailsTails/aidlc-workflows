import {
  advisoryContextPayload,
  corruptionWarning,
  invokedProjectDirectory,
  readSharedCoreBare,
} from "./shared-core-bare.ts";

const HOOK_EVENT_NAME = "PostToolUse";

const reading = readSharedCoreBare({
  startDirectory: invokedProjectDirectory(),
});

if (reading.state === "corrupt") {
  process.stdout.write(
    `${advisoryContextPayload({
      hookEventName: HOOK_EVENT_NAME,
      additionalContext: corruptionWarning({
        sharedConfigPath: reading.sharedConfigPath,
      }),
    })}\n`,
  );
}

process.exit(0);
