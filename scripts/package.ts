#!/usr/bin/env bun
import { runPackageCommand } from "../src/cli/main.ts";
import { createNodeFileSystem } from "../src/kernel/file-system.ts";
import { createNodeProcessRunner } from "../src/kernel/process-runner.ts";
import { createBunYamlParser } from "../src/kernel/yaml-parser.ts";
import { createBunContentDigester } from "../src/kernel/content-digester.ts";
import { createProcessTerminal } from "../src/kernel/terminal.ts";
import { createLegacyPluginProjector } from "../src/projection/adapters/legacy-plugin-emit.ts";
import { createPackageBuildRoot } from "../src/cli/package-build-root.ts";
import { createMarkdownOutliner } from "../src/workflow-definition/adapters/markdown-outliner.ts";
import { modelCapFor } from "../src/projection/domain/model-cap-for.ts";
import { markdownBlocks } from "../core/tools/aidlc-markdown.ts";
import { readEnvCap, readMemoryCap } from "../core/tools/aidlc-tiers.ts";

process.exitCode = await runPackageCommand({ argv: process.argv.slice(2),
  resolveModelCap: (mode) => modelCapFor({ mode,
    environment: { cap: mode === "check" ? null : readEnvCap(),
      presence: process.env.AIDLC_TIER_CAP ? "set" : "unset" },
    memory: readMemoryCap(Bun.fileURLToPath(new URL("../core/memory/", import.meta.url))) }),
  composition: { createNodeFileSystem, createNodeProcessRunner, createBunYamlParser,
    createBunContentDigester, createPluginProjector: createLegacyPluginProjector,
    createProcessTerminal: () => createProcessTerminal({ streams: { stdout: process.stdout, stderr: process.stderr } }),
    createPackageBuildRoot, outliner: createMarkdownOutliner(markdownBlocks),
    workingDirectory: Bun.pathToFileURL(`${process.cwd()}/`) },
});
