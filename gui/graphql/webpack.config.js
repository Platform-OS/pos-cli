const path = require('path');
const webpack = require('webpack');
const { ESBuildMinifyPlugin } = require('esbuild-loader');

const prod = process.env.NODE_ENV === 'production';

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  output: {
    path: path.resolve('public'),
  },
  resolve: {
    extensions: ['.mjs', '.jsx', '.js', '.css'],
    fallback: { assert: require.resolve('assert/') },
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV),
      },
    }),
  ],
  optimization: {
    minimizer: [
      new ESBuildMinifyPlugin({
        target: 'node12', // Syntax to compile to (see options below for possible values)
        css: true,
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: 'esbuild-loader',
        exclude: /node_modules/,
        options: {
          loader: 'jsx',
          target: 'node12',
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  mode: prod ? 'production' : 'development',
  stats: prod ? 'normal' : 'minimal',
  bail: prod,
  performance: { hints: false }
};
