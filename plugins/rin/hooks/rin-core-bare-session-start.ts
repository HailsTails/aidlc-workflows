import {
  corruptionWarning,
  invokedProjectDirectory,
  readSharedCoreBare,
} from "./shared-core-bare.ts";

const reading = readSharedCoreBare({
  startDirectory: invokedProjectDirectory(),
});

if (reading.state === "corrupt") {
  process.stdout.write(
    `${corruptionWarning({ sharedConfigPath: reading.sharedConfigPath })}\n`,
  );
}

process.exit(0);
