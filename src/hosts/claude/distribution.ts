import type { HostDistribution } from "../../packaging/domain/payload.ts";
import { accepted, type Result } from "../../kernel/result.ts";
import { contentHash, projectPath, type ContentHash, type KernelRefusal } from "../../kernel/values.ts";

const GITIGNORE_PRIOR_HASHES = [
  "sha256:3da36b2d01551aeae2e366caa08be8cce0dbc9110e252445dcaa4e758e24a0b6",
  "sha256:4f1cd2e930bd37d2f5d715a06ea3fa1e2d39479fc662f0f0562116376132114b",
  "sha256:f2affb8b34499f057284852456cb8a24ae586b8e816595bf98346141f3516281",
  "sha256:d397e69ac701a663158ccb43fda3f0a23c86365f29419a8c9a5e3287a490370d",
  "sha256:87e4c1237816c477096f2291f1204885692bf39e487afb3d9f67cf7e9b2c84fb",
  "sha256:1d51ae4ca4f74f842336dce75bc66bb4bbf55ce2de7c802ab059504cca99fd7b",
  "sha256:631688bc85683ea22c9415cb345c69169cff4ac45ec006c258217cd261a7793f",
  "sha256:051866aa49f8ed915ab5ae30707422068df814ca5be806a1fe28784c543a4aab",
  "sha256:a618a3a615ef7159c7eed634a5a332bf9d017f8e28d6b0f0adad9db1d2d725e0",
  "sha256:3cc1cbd212d2ca0dbf1e525eb9a40d4694a585eb7864d8b877f8fe8bd99122dc",
];

const priorHashes = (values: readonly string[]): Result<readonly ContentHash[], KernelRefusal> =>
  values.reduce<Result<readonly ContentHash[], KernelRefusal>>((hashes, raw) => {
    if (!hashes.ok) return hashes;
    const hash = contentHash(raw);
    return hash.ok ? accepted([...hashes.value, hash.value]) : hash;
  }, accepted([]));

export const claudeDistribution = (): Result<HostDistribution, KernelRefusal> => {
  const gitignore = projectPath(".gitignore");
  if (!gitignore.ok) return gitignore;
  const mcp = projectPath(".mcp.json");
  if (!mcp.ok) return mcp;
  const directory = projectPath(".claude");
  if (!directory.ok) return directory;
  const workspace = projectPath("aidlc");
  if (!workspace.ok) return workspace;
  const gitignoreHashes = priorHashes(GITIGNORE_PRIOR_HASHES);
  if (!gitignoreHashes.ok) return gitignoreHashes;
  const context7 = contentHash("sha256:8a440d21705f35c8f5649f118d17f786e08d589fb2dd888f5de5aa503233afbf");
  if (!context7.ok) return context7;
  const awsMcp = contentHash("sha256:d6ff496cb02a8b61d81f8534b179f60e42173ee8510eebe3428bf0bfe30ff0aa");
  if (!awsMcp.ok) return awsMcp;
  const awsPricing = contentHash("sha256:43bc3467687da178f795ad41ad8767da8b255780f95b64d5c7464b2fbff9ef40");
  if (!awsPricing.ok) return awsPricing;
  const awsIac = contentHash("sha256:9fea0efb8aea62ec3446cc8201bc74cae477c75d36659b47e93d53981cb94686");
  if (!awsIac.ok) return awsIac;
  const awsServerless = contentHash("sha256:858610c8f5ccbbecc39595fdf866f68d0fb32d62750b3d50ee4bdef7ec1d104b");
  if (!awsServerless.ok) return awsServerless;
  return accepted<HostDistribution>({
    layout: {
      rootIntegrations: [
        { path: gitignore.value, policy: "managed-block", marker: "gitignore", sharing: "union", presence: "required" },
        { path: mcp.value, policy: "json-map", key: "mcpServers", presence: "optional" },
      ],
      managedDirectories: [
        { path: directory.value, ownership: "shipped-files-only" },
        { path: workspace.value, ownership: "shipped-files-only" },
      ],
    },
    priorIntegrations: [
      { integration: gitignore.value, wholeFileHashes: gitignoreHashes.value, entryHashes: {} },
      { integration: mcp.value, wholeFileHashes: [], entryHashes: {
        context7: [context7.value], "aws-mcp": [awsMcp.value], "aws-pricing": [awsPricing.value],
        "aws-iac": [awsIac.value], "aws-serverless": [awsServerless.value],
      } },
    ],
    listing: {},
    native: { replacements: [], copyOnly: [], permissionsLine: "exact-reads" },
    plugin: {
      format: "store", manifestDir: ".claude-plugin", marketplaceDir: ".claude-plugin", catalogue: "written",
      installRoots: [".claude", ".gitignore", ".mcp.json", "aidlc"],
    },
  });
};
