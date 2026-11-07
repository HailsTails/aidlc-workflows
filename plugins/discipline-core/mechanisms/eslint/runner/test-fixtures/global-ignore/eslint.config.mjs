import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  { ignores: ["gen/**", "nothing-here/**"] },
  ...projection,
];
