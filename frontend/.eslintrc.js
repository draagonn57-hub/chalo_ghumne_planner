// .eslintrc.js — read by react-scripts (ESLint 8 via CRA) during compilation.
// eslint-config-react-app already includes eslint-plugin-react-hooks internally,
// so we must NOT re-declare it under "plugins" — that causes the conflict error:
// "Plugin react-hooks was conflicted between .eslintrc.js and eslint-config-react-app"
module.exports = {
  extends: [
    "react-app",
    "react-app/jest",
  ],
  rules: {
    "react-hooks/rules-of-hooks":  "error",
    "react-hooks/exhaustive-deps": "warn",
  },
};
