import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
  { files: ["x.ts"], rules: { "rin-discipline/no-class-authoring": "off" } },
];
