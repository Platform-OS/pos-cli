const path = require('path');
const webpack = require('webpack');

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
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.jsx?$/,
        loader: 'babel-loader',
        options: { cacheDirectory: true },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
};
