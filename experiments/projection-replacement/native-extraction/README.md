# Native source extraction proposals

These patches target fork base `d062c81e5678c9f92162542b425b8a5f095e46e1` in this order:

1. `fork-native-command-text.patch`: separates source-owned native command text preparation from the packager.
2. `fork-static-route-contract.patch`: separates authoritative route declarations from the executable dispatcher.
3. `fork-runtime-module-inventory.patch`: separates declared modules from invocation candidates in the Codex and OpenCode emitters.

Apply each only in a separate review checkout with `git apply --unidiff-zero <patch>`. The patches are proposals, not changes applied to this branch's main runtime. Run `bun test scripts/native-command-text.test.ts` and the source package checks after application.

This snapshot includes the corresponding experimental consumer. It does not establish native host activation, all-harness parity, or release readiness. Generated distributions and local verification outputs are not included.
