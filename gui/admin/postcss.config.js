const csso = require('postcss-csso')({ comments: false });

const production = !process.env.ROLLUP_WATCH;

module.exports = {
  plugins: [
    require("postcss-import")(),
    require("tailwindcss"),
    require("autoprefixer"),
    production && csso
  ]
};