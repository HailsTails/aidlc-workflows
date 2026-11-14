import type { HostDistribution } from "../../packaging/domain/payload.ts";
import { accepted, type Result } from "../../kernel/result.ts";
import { contentHash, projectPath, type ContentHash, type KernelRefusal } from "../../kernel/values.ts";

const GITIGNORE_PRIOR_HASHES = [
  "sha256:f919e4bac1790bd1a371d371af473ccbc644f3bb80e4569d190c9364fad771b3",
  "sha256:d2569b56aef154c3c04766ed3263947a2d8026c99546a3006775526641951db9",
  "sha256:ced6459be00ce352fe298e1ff07759933fa2ebf07a9151ef2f1af995579f7afd",
  "sha256:007b95fb94d4a2569f4254088f0d70f4f345ff99db34e2784b6d9bc5c169f853",
  "sha256:25e76c09640300e354ab34e3c67e89d2dfe473940b65bd56c227ca4d5ea92c7b",
  "sha256:51cb399f2257236cbf63e18cb2e317d75913f1771b5402707a2508cf5f81fa57",
  "sha256:345fbe9fe620718510ecfe9d478233ccf4a5318522884b50fc5540559ace3eed",
];
const AGENTS_PRIOR_HASHES = [
  "sha256:30a9f5f43d87cd29b63e75333b8ef6695f8f4e11909fd6af64e2b6cf0b8cb292",
  "sha256:47678f42e0233de9b0164eb4ec318a3ba3196074d6ec88f69aa7980bc1f2fd0d",
  "sha256:821b2149c7c6c2b6592eecd10623823fc5579fc4ae52f2ad272e00c93013d027",
  "sha256:83c6e5141646dc604c87d80622fc898761a69bd0c9caebb398441bce9f1d0727",
  "sha256:b3a07e9bb603fb0a2328004fc7cf2294afc670ec6f350a43de9c15d6e27aa04e",
  "sha256:bfc2adb83e00041750b1d19c9f3167cb7f5f5502a62af83a58d0a2828890febf",
  "sha256:d8afae6a0813f5298cf873a047664cf485308c6e0dad41dde53d8dcb27dd7769",
  "sha256:f1deb7dc72a78fe7d39c71ad2fe6c0f41248c03cde7fb36b7a478f5b9233881c",
  "sha256:f7c55e9917d3801f676fba066fdd78d8df2c36311e8d6e78068965fc7b4371fa",
  "sha256:457ff3626bf6ff4a0f6f1f7a44a1d2cbcd91490600e2332742dcf655da25b7f3",
  "sha256:9be9c5cc4a25e5b4c71b3ae35188e1a543504f19cbd5d0a20892777b0904800e",
  "sha256:bc41aca84970977673af3c0b8212a1f7a4d995a4b47fc7894b1c5b342e4a3601",
  "sha256:b3d4d0d178a01591629dbf79083b00e7a3ad42f59f79cbfc88d05b7615704a70",
  "sha256:d9be36630b49183203ae4d97946c243e3b8840202ee6f080c738e0f01343e33a",
  "sha256:cc3212fc7335018158882cbaa141ac6fd02cee53bbceb00bd185f416fa06ff8f",
  "sha256:412776ee4595c453511a911e06c7729285bb5338b30584f8570908b273e27296",
  "sha256:dd650e54fb2e645b6f30002f91f8f6f174fe34550295582f5b6a95356edaed77",
  "sha256:87563548299dd2a0c1fcd3cde480b612bd1ec767a2550dbc05a6a041a3d7f522",
  "sha256:c7843449d549d4226be39169a9c31bf89694cd0b0754cb1ee68bdf61759538ce",
  "sha256:6de1298dfa4c2b6916f66d372b844faf23481c8f258eedd595c1423dab8e106d",
];

const priorHashes = (values: readonly string[]): Result<readonly ContentHash[], KernelRefusal> =>
  values.reduce<Result<readonly ContentHash[], KernelRefusal>>((hashes, raw) => {
    if (!hashes.ok) return hashes;
    const hash = contentHash(raw);
    return hash.ok ? accepted([...hashes.value, hash.value]) : hash;
  }, accepted([]));

export const codexDistribution = (): Result<HostDistribution, KernelRefusal> => {
  const gitignore = projectPath(".gitignore");
  if (!gitignore.ok) return gitignore;
  const agents = projectPath("AGENTS.md");
  if (!agents.ok) return agents;
  const skills = projectPath(".agents");
  if (!skills.ok) return skills;
  const directory = projectPath(".codex");
  if (!directory.ok) return directory;
  const workspace = projectPath("aidlc");
  if (!workspace.ok) return workspace;
  const gitignoreHashes = priorHashes(GITIGNORE_PRIOR_HASHES);
  if (!gitignoreHashes.ok) return gitignoreHashes;
  const agentsHashes = priorHashes(AGENTS_PRIOR_HASHES);
  if (!agentsHashes.ok) return agentsHashes;
  return accepted({
    layout: {
      rootIntegrations: [
        { path: gitignore.value, policy: "managed-block", marker: "gitignore", sharing: "union", presence: "required" },
        { path: agents.value, policy: "managed-block", marker: "agents", sharing: "identical", presence: "required" },
      ],
      managedDirectories: [
        { path: skills.value, ownership: "shipped-files-only" },
        { path: directory.value, ownership: "shipped-files-only" },
        { path: workspace.value, ownership: "shipped-files-only" },
      ],
    },
    priorIntegrations: [
      { integration: gitignore.value, wholeFileHashes: gitignoreHashes.value, entryHashes: {} },
      { integration: agents.value, wholeFileHashes: agentsHashes.value, entryHashes: {} },
    ],
    listing: {},
    native: { replacements: [], copyOnly: [], permissionsLine: "prefix-only" },
    plugin: {
      format: "store", manifestDir: ".codex-plugin", marketplaceDir: ".agents/plugins", catalogue: "written",
      installRoots: [".agents", ".codex", ".gitignore", "AGENTS.md", "aidlc"],
    },
  });
};
