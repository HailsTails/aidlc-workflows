import type { FileContent } from "../../kernel/file-content.ts";
import { hash } from "../../kernel/fixtures/values.fixture.ts";
import type { ContentHash } from "../../kernel/values.ts";

const FIXED_HASHES: ReadonlyMap<string, string> = new Map([
  [
    "---\nname: aidlc-developer-agent\ndescription: Senior developer responsible for co" +
      "de generation, reverse engineering, and data modelling.\ndisallowedTools: Task\nmo" +
      "del: inherit\n---\n\n# Developer Agent\n",
    "sha256:a730e4d4268c7906dd85885f4c2de66d3af4f045d2eb0ac03ddd48c08d3c5326",
  ],
  [
    "---\nname: aidlc-developer-agent\ndisplay_name: Developer Agent\ntier: balanced\n-" +
      "--\n\n# Developer Agent\n",
    "sha256:863949983cd196885d512b601bf6b1a1c1c7ea2d5e2eea4effcacd9e6f0eb081",
  ],
  [
    "---\nname: aidlc-code-generation\ndescription: Run AI-DLC stage 3.5 Code Generatio" +
      "n\ndisable-model-invocation: true\n---\n",
    "sha256:5e312852de6e183521a2719293865370e1e2b196c9dd5286b9389a3896fa22d5",
  ],
  [
    "---\nname: aidlc-feature\ndescription: Run the feature scope\ndisable-model-invoca" +
      "tion: true\n---\n",
    "sha256:3641d0f7992bdb810cfcb4eb559a01755f8e16275eb0b3ef815907be4b35f20a",
  ],
  [
    "---\nslug: code-generation\nphase: construction\n---\n",
    "sha256:20a0d9d7e79816bd3068a05fa351c01f028170695af6f02c51ad3bbb9c370f28",
  ],
  [
    "# Code Generation Guide\n",
    "sha256:6109428b0c94525fae102ff4175965ba17e5ae27a2c847bf4cbbfbe9638a4eb3",
  ],
  [
    "{\n  \"hooks\": {\n    \"UserPromptSubmit\": [{ \"hooks\": [{ \"type\": \"command\"" +
      ", \"command\": \"aidlc engine hook record-human-turn\" }] }]\n  }\n}\n",
    "sha256:0bc504601ad6e02566b12be53fe175d421ab786f086dc320cef1251e5ad43bc8",
  ],
  [
    "# AI-DLC\n\nType `/aidlc` to start.\n",
    "sha256:58bb09a949ed03ae21bb9d4b7b61fb69ee82fb5e90ae8882b040040b5aea951d",
  ],
  [
    "# >>> aidlc gitignore\naidlc/**/.aidlc-*\n# <<< aidlc gitignore\n",
    "sha256:d0032c1f61341cef5fcf8fabc5f93c0a290999e8e3ce9bb933883e081c97d5ff",
  ],
  [
    "#!/usr/bin/env bun\nexport {};\n",
    "sha256:f3b2989724efbf7b154b10283b87780d53ee348055b20c76f86634ee512a2f93",
  ],
  [
    "{ \"schemaVersion\": 1, \"frameworkVersion\": \"2.12.0\", \"distribution\": \"clau" +
      "de\", \"harnessDir\": \".claude\" }\n",
    "sha256:309f56e99f886e298943a6106b6eab0cd533535d40af3bcfc9e198ba57252948",
  ],
  [
    "{ \"schemaVersion\": 2, \"frameworkVersion\": \"2.12.0\" }\n",
    "sha256:1c2d129531efe718bfcec08dced596315217a6ae81e83192059cb51259c7540c",
  ],
  [
    "node_modules/\n# >>> aidlc gitignore\n.aidlc-*\n# <<< aidlc gitignore\n",
    "sha256:03e5a56e659249fcfddde50ede4a6d4719969a2f15ec384ec1d0cf23f0ca4651",
  ],
  [
    "node_modules/\n# >>> aidlc gitignore\naidlc/**/.aidlc-*\n# <<< aidlc gitignore\n",
    "sha256:d261eaecb9fa83dc3e3c3bd6ca70cc909197e6ad1fdf34cfbb24ce88cd62dd77",
  ],
  [
    "aidlc/**/.aidlc-*\n",
    "sha256:84fcf62c2fd7a35c8e662a7d2f5318399fd5163a98bc0b283d4227b3b571f687",
  ],
]);

export const hashOf = (content: FileContent): ContentHash => {
  const fixed = content.kind === "text" ? FIXED_HASHES.get(content.text) : undefined;
  if (fixed === undefined) {
    throw new Error("The fixtures hold no fixed hash for this content");
  }
  return hash(fixed);
};
