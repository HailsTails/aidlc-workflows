import { configR7OptIn } from "./rin-harness-config.ts";
import {
  legacyExceptionPass,
  passReport,
} from "./rin-harness-legacy-exception-pass.ts";

const projectDir = process.cwd();
const pass = legacyExceptionPass({
  projectDir,
  optIn: configR7OptIn({ projectDir }),
});
const report = passReport({ pass });

process.stderr.write(report.stderr);
process.stdout.write(report.stdout);
process.exit(report.exitCode);
