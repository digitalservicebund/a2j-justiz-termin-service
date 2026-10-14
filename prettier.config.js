/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  plugins: ["prettier-plugin-organize-imports"],
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  bracketSameLine: false,
  endOfLine: "auto",
};

export default config;
