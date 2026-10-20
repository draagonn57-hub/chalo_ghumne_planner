const path = require("path");
const webpack = require("webpack");

module.exports = {
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    plugins: {
      add: [
        new webpack.DefinePlugin({
          "process.env.REACT_APP_BUILD_DATE": JSON.stringify(
            new Date().toISOString().split("T")[0]
          ),
        }),
      ],
    },
  },
  jest: {
    configure: {
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
  },
};