/**
 * eslint-plugin-local · index · registry of local rules used inside
 * zero-risk-dashboard. New rules go in `./rules/` · register them
 * below.
 */
const noFunctionFormatProp = require("./rules/no-function-format-prop")

module.exports = {
  rules: {
    "no-function-format-prop": noFunctionFormatProp,
  },
  configs: {
    recommended: {
      plugins: ["local"],
      rules: {
        "local/no-function-format-prop": "error",
      },
    },
  },
}
