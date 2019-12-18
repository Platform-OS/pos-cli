const path = require('path');

const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

module.exports = {
  mode: mode,
  entry: { main: './src/index.jsx' },
  output: {
    filename: '[name].js',
    path: path.resolve('public')
  },
  resolve: {
    extensions: ['.mjs', '.jsx', '.js', '.css']
  },
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.jsx?$/,
        loader: 'babel-loader?cacheDirectory'
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  }
};
