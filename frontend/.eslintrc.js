// .eslintrc.js — read by react-scripts (ESLint 8 via CRA) during compilation.
// Extends the standard CRA config so all react-app rules are included,
// and adds eslint-plugin-react-hooks so react-hooks/* rules are defined.
module.exports = {
  extends: [
    "react-app",
    "react-app/jest",
  ],
  plugins: [
    "react-hooks",
  ],
  rules: {
    "react-hooks/rules-of-hooks":  "error",
    "react-hooks/exhaustive-deps": "warn",
  },
};
