import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
  { name: "discipline-core/authorised-location/CD-14#class-syntax/x.ts", files: ["x.ts"], rules: { "rin-discipline/no-class-authoring": "off" } },
];
