import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { hash, path } from "../../kernel/fixtures/values.fixture.ts";
import { accepted } from "../../kernel/result.ts";
import { kiroDistribution } from "./distribution.ts";

test("Kiro declares the exact roots, prior shapes, listing and plugin distribution", () => {
  expect(kiroDistribution()).toEqual(accepted({
    layout: {
      rootIntegrations: [
        { path: path(".gitignore"), policy: "managed-block", marker: "gitignore", sharing: "union", presence: "required" },
        { path: path("AGENTS.md"), policy: "managed-block", marker: "agents", sharing: "identical", presence: "required" },
      ],
      managedDirectories: [
        { path: path(".kiro"), ownership: "shipped-files-only" },
        { path: path("aidlc"), ownership: "shipped-files-only" },
      ],
    },
    priorIntegrations: [
      { integration: path(".gitignore"), wholeFileHashes: [
        hash("sha256:83449fdda4644b319cbea5dcbde11919722b5dd6761f4edb4caf0e0e53dc9c6b"),
        hash("sha256:469dbf89f83865b58b2ae4c51dd2f2fe51fd80a9e2033bfb233688141d0cf632"),
        hash("sha256:af1b98a4b8c0e288aa8177655495b4a65220dbed2e149a67780aff1e8f379c9d"),
        hash("sha256:2f413414992c405c11a8bccb230574c2f58cec8fd2906cd37b7cd62bb33a97d8"),
        hash("sha256:f08d78b3e456c3a7cd7c998196c9bf6d59d24900e2ccf78cf30a1b189e766c2c"),
        hash("sha256:28a69800dcac189aa2a976820db237b45bcf6dd7d7e6d4fae5c1603225b9957a"),
        hash("sha256:99b4560aa1bd95f26077eb69a0c6c2a40f81146a212e70d876c27bb84f2b1789"),
      ], entryHashes: {} },
      { integration: path("AGENTS.md"), wholeFileHashes: [
        hash("sha256:4f7133cc1a9bb1243245c25c28fad57c3660b35e251ea36cea3aa2db431bf55f"),
        hash("sha256:992307cc3fac05d81958851b2ca51db3723fea604c8d2636814ef9b2e9f7a848"),
        hash("sha256:b886d5b375f9ebc33ef206c4f6ad20630a13eb83d0f5838e9f71f483c040f362"),
        hash("sha256:c6796d512752c8f4aa927c9de3fb794e3432f62dd85b77fe3da1101d90aa5a0b"),
        hash("sha256:cd7c66ba1bdd67af0be6203a1d8928efc01733ef196201003e914051d1309a28"),
        hash("sha256:e01ac1caf52a59d25faf859a03cfb65b803853c99298bbcbc80ef565e7628de6"),
        hash("sha256:e3de4a295f9b9404b40678c28c0773ae432ac8d4aeacc07613ecfcdfbb4c866b"),
        hash("sha256:e85a5d7ce13b676282dc99572f89c81256f2dada50b1881f4c9641e61339f5a4"),
        hash("sha256:67a57eddd94d613590d34ec2d0181398123d9e2d9f6382eb36c62233ce02b6f9"),
        hash("sha256:3aea80a2afde8bb2a222b329bcfc2855b4207a53f7fbfbc3abbfb4aadbafc53b"),
        hash("sha256:1abeb3cb19943bc1537c413dc45298c43a14ce7544444c88c13b53ea48a607a6"),
        hash("sha256:ecb68f08789258e77c81488e98dd1632b607b567a2424311c4dcdc30ce3e768f"),
        hash("sha256:9ad7daa07cbafe9f149311b679281eecd991d2ec77787fc7751226ea0622522b"),
        hash("sha256:c8777a03505f11dcbb4fb339fef1a8072d9d2500ce401b69a06073b523ea2c67"),
        hash("sha256:6de1298dfa4c2b6916f66d372b844faf23481c8f258eedd595c1423dab8e106d"),
      ], entryHashes: {} },
    ],
    listing: { choiceName: "Kiro CLI (V2)" },
    native: { replacements: [], copyOnly: [], permissionsLine: "exact-reads" },
    plugin: {
      format: "kiro", manifestDir: ".kiro-plugin", marketplaceDir: ".kiro-plugin", catalogue: "none",
      installRoots: [".gitignore", ".kiro", "AGENTS.md", "aidlc"],
    },
  }));
});

test("Kiro's declared top-level directories match the verified legacy descriptor", () => {
  const distribution = accept(kiroDistribution());
  expect(distribution.layout.managedDirectories).toHaveLength(2);
  expect([
    distribution.layout.managedDirectories[0]?.path,
    distribution.layout.managedDirectories[1]?.path,
  ]).toEqual([path(".kiro"), path("aidlc")]);
});
