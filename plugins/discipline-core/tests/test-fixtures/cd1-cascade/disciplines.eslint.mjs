import piece0 from "../../../mechanisms/eslint/CD-1/cd1/cd1.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/discipline-cd1",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline-cd1": piece0 },
    rules: { "discipline-cd1/implicit-any-let": "error", "discipline-cd1/no-explicit-any": "error" },
  },
  {
    name: "discipline-core/file-carve-out/CD-1#explicit-any/src/legacy.ts",
    files: ["src/legacy.ts"],
    rules: { "discipline-cd1/no-explicit-any": "off" },
  },
];
