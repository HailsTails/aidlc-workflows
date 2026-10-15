import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
  { files: ["src/owned.ts"], rules: { "rin-discipline/no-class-authoring": "error" } },
];
