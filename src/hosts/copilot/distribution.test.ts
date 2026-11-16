import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { hash, path } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { copilotDistribution } from "./distribution.ts";

test("Copilot declares its exact roots, prior shapes and plugin discovery", () => {
  expect(copilotDistribution()).toEqual(accepted({
    layout: {
      rootIntegrations: [
        { path: path(".gitignore"), policy: "managed-block", marker: "gitignore", sharing: "union", presence: "required" },
        { path: path(".vscode/settings.json"), policy: "jsonc-settings", presence: "optional" },
        { path: path("AGENTS.md"), policy: "managed-block", marker: "agents", sharing: "exclusive", presence: "required" },
      ],
      managedDirectories: [
        { path: path(".aidlc"), ownership: "shipped-files-only" },
        { path: path(".github"), ownership: "shipped-files-only" },
        { path: path("aidlc"), ownership: "shipped-files-only" },
      ],
    },
    priorIntegrations: [
      { integration: path(".gitignore"), wholeFileHashes: [
        hash("sha256:f52e6097d36c2e5bc199a2529469a4c6e7c507f7960f94a0b2b46f9aeee60e56"),
        hash("sha256:1a25bf94915b9f1c67136cfb36f5c82c03c6f6540deddd2af9e760e0f93069df"),
        hash("sha256:a739ce7cf309c603b4c962313a53cb2a238888b73c204a86f928cd61dcb3e548"),
        hash("sha256:d23129d2d4de49fdd943b9966c2995cc5064b365a2741c8b4a8f50c0facf2c1a"),
        hash("sha256:a2fb9d52cb1ad3a360d7abdaddabb6920965b6b1a7acceb14881ad93b4975bbe"),
        hash("sha256:2091d36da7f7306179da27227857564334f3a455327f365984db6c94a4cc6412"),
      ], entryHashes: {} },
      { integration: path("AGENTS.md"), wholeFileHashes: [
        hash("sha256:9550b31b8f3f32992c1ae1035bfa57a782f04821530214a2f2e1fd1690e209ab"),
        hash("sha256:1b8b3b4b10de3307a927429a676f5dd7440099a6d18859f603328b5ed239e6c7"),
        hash("sha256:bf3077a6520e2735f618bad386858afc57edceaa791d98de7a6c269d71861e56"),
        hash("sha256:55b31ba55f6e7ebc47fe76a00039e2ec16e020503fb63791cbd8665438ff32ac"),
        hash("sha256:7a3a19981ba7a3c447b54eb0d0b1e96f8c9931687595967103cb5dfbb3c2b309"),
        hash("sha256:622ebad60ee4fed6a2a9811e7378ccbff6b76d651aaee00fd079b02471d8cf06"),
        hash("sha256:a25a15052889fe6b5900f0fef5262cc50cb00bb436e52f1eb1abe62db35b2f50"),
        hash("sha256:2f43e54233a3feefa17e8dd3c6fd65f0ef50268d7fe46b3adb93c1d6bcf15a89"),
        hash("sha256:1095316799b8630bcb498539cb82b9b0907fa7aa69cdfb3ee6a9b489c8ed42e3"),
        hash("sha256:d35dbc2ff6a2cad09144e8a625144bfbce4c0e91212a2da39d45da11198474f4"),
        hash("sha256:33c0f4b7fc213c3bddcc81d33de244e07a05659d1fc8ac474da63f4b4d19b2d6"),
        hash("sha256:1aa11fdd7d49c9d390e9ef99004b76eef31541da5f20d52e311f633120f3579b"),
        hash("sha256:038b76450d7264af3092a0121bb60567f31391180f244532a399867ed94ca994"),
        hash("sha256:00efc5b85d53364a162f5f0eb604842f96fa94fdcb1e23ee6c286b707b93f336"),
        hash("sha256:7d1b6554a2de2b97b8e14f96ec99d218722d18c100de166cb1a5831bb2c11bfc"),
        hash("sha256:cdfb9d50a7899b4c5a2aa3128d49a2f50c12ee9d3aba13dbe42ff92ad7a2f22e"),
        hash("sha256:3979d69468a5997423ef8fe3b7d9f9bc948ddf34524ca39e1c10112a6a80f835"),
        hash("sha256:2a818c7c6a39421df576d70829d4d2c960809df3d60b32ca1a0659965c56433a"),
        hash("sha256:0274b7bd2c26f8fc6158aafd6632a99aced247305d2aa09d1c60312283de7e69"),
        hash("sha256:6130b11ceb91e334f30940d3a3a1f40b41e82519ac777b0177c089b35f348442"),
        hash("sha256:ad6ccb9e0d8fbfc3224448ed45c6d3b278ffb8afdffe697ef2f362cfafeb44bf"),
        hash("sha256:fde31c458f35dc77c83845acdad3d4715a4c87a219f2004fc6c96625c7933d29"),
        hash("sha256:724c2e36547e1eab35a3637595cea3f4bf1ddecf75fb798e0e165932c06cd93e"),
        hash("sha256:b0f5e39317a501be8567bbb0ecbdff651116abc28a500b9c451b732ca8f2e088"),
        hash("sha256:b87a3ec2c39cb24074c6fa37f626e9d150d435d18069fbd0c762fdbd70719c5c"),
      ], entryHashes: {} },
    ],
    listing: {},
    native: { replacements: [], copyOnly: [], permissionsLine: "prefix-only" },
    plugin: {
      format: "store", manifestDir: ".plugin", marketplaceDir: ".plugin", catalogue: "written",
      installRoots: [".aidlc", ".github", ".gitignore", ".vscode", "AGENTS.md", "aidlc"],
    },
  }));
});

test("Copilot's declared directories match the verified legacy descriptor without owning VS Code", () => {
  const distribution = accept(copilotDistribution());
  expect(distribution.layout.managedDirectories).toHaveLength(3);
  expect([
    distribution.layout.managedDirectories[0]?.path,
    distribution.layout.managedDirectories[1]?.path,
    distribution.layout.managedDirectories[2]?.path,
  ]).toEqual([path(".aidlc"), path(".github"), path("aidlc")]);
});
