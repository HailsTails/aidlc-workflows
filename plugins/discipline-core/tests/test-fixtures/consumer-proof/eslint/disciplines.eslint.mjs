import piece0 from "../../../../mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline": piece0 },
    rules: { "discipline/no-class-authoring": "error", "discipline/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },
  },
];
