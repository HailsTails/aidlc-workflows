import type { TestSuite } from "../application/tests-check.ts";

export const sourceSuites = (bun: string): readonly TestSuite[] => [
  {
    name: "src",
    triggers: ["src/**", "packaging/build-distributions.ts"],
    tests: ["src/**/*.test.ts"],
    command: () => ({ label: "bun test ./src", argv: [bun, "test", "./src"] }),
  },
];
