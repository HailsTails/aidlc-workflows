import type { HostDistribution } from "../../packaging/domain/payload.ts";
import { accepted, type Result } from "../../kernel/result.ts";
import { contentHash, projectPath, type ContentHash, type KernelRefusal } from "../../kernel/values.ts";

const GITIGNORE_PRIOR_HASHES = [
  "sha256:b4bf7694361e76aae9feabc5d985d09afb7863cf8458b0c9aaa73f20a589582f",
  "sha256:a87496436cb23f303dee533322bd0896e981e14be1a7abd18e76aa5e113be02c",
  "sha256:f9fbe33a3e622010a8a45ef199e104077db6ee7ee27137c08c34e81c1a0c24a4",
  "sha256:8c5a09fbee163fa2a02fbccb1695c2f66a79507a180456240dd380b681b97506",
  "sha256:cf4554ef90011ebc4bc70c7fbc6ca572c513d5c1e7daa328e406d1069f98e635",
  "sha256:ae1878ec98301ceb4510e711cf79f58dfb44cb486744007acd03ae5e61860665",
];
const AGENTS_PRIOR_HASHES = [
  "sha256:78c906200a55665f3a3ce410272c71d4bdcb5764174407da0f69d8ad6d143184",
  "sha256:2907b5293bfd8bd9d5f8b7a8025bfe23edd0ffcd31f925761916088517880936",
  "sha256:2ef8a8cd1b72e59d017013b8d261721b1c5dedb82499b44dc9a97be01b6a73cb",
  "sha256:eeabf9f9555124da3f5ad34eb3a26b9fcbf3e2ccd65610cb9f0182701cf3ef48",
  "sha256:6de1298dfa4c2b6916f66d372b844faf23481c8f258eedd595c1423dab8e106d",
];

const priorHashes = (values: readonly string[]): Result<readonly ContentHash[], KernelRefusal> =>
  values.reduce<Result<readonly ContentHash[], KernelRefusal>>((hashes, raw) => {
    if (!hashes.ok) return hashes;
    const hash = contentHash(raw);
    return hash.ok ? accepted([...hashes.value, hash.value]) : hash;
  }, accepted([]));

export const cursorDistribution = (): Result<HostDistribution, KernelRefusal> => {
  const gitignore = projectPath(".gitignore");
  if (!gitignore.ok) return gitignore;
  const agents = projectPath("AGENTS.md");
  if (!agents.ok) return agents;
  const directory = projectPath(".cursor");
  if (!directory.ok) return directory;
  const workspace = projectPath("aidlc");
  if (!workspace.ok) return workspace;
  const installer = projectPath("install.ts");
  if (!installer.ok) return installer;
  const installerHash = contentHash("sha256:338e1d36257108ce908eb42992e87e5df7cf96003a45e04a72189e4d79110aba");
  if (!installerHash.ok) return installerHash;
  const gitignoreHashes = priorHashes(GITIGNORE_PRIOR_HASHES);
  if (!gitignoreHashes.ok) return gitignoreHashes;
  const agentsHashes = priorHashes(AGENTS_PRIOR_HASHES);
  if (!agentsHashes.ok) return agentsHashes;
  return accepted({
    layout: {
      rootIntegrations: [
        { path: gitignore.value, policy: "managed-block", marker: "gitignore", sharing: "union", presence: "required" },
        { path: agents.value, policy: "managed-block", marker: "agents", sharing: "identical", presence: "required" },
        { path: installer.value, policy: "whole-file", sharing: "exclusive", presence: "required" },
      ],
      managedDirectories: [
        { path: directory.value, ownership: "shipped-files-only" },
        { path: workspace.value, ownership: "shipped-files-only" },
      ],
    },
    priorIntegrations: [
      { integration: gitignore.value, wholeFileHashes: gitignoreHashes.value, entryHashes: {} },
      { integration: agents.value, wholeFileHashes: agentsHashes.value, entryHashes: {} },
      { integration: installer.value, wholeFileHashes: [installerHash.value], entryHashes: {} },
    ],
    listing: {},
    native: {
      replacements: [{
        from: "run `bun .cursor/tools/aidlc.ts doctor` (after installing Bun from https://bun.sh/install if `bun` is not found),",
        to: "run `aidlc doctor`,",
      }],
      copyOnly: [installer.value], permissionsLine: "exact-reads",
    },
    plugin: {
      format: "cursor", manifestDir: ".cursor-plugin", marketplaceDir: ".cursor-plugin", catalogue: "written",
      installRoots: [".cursor", ".gitignore", "AGENTS.md", "aidlc", "install.ts"],
    },
  });
};
