import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
  { rules: { "discipline/no-class-authoring": "off" } },
];
