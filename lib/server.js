const path = require('path');
const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();

const Gateway = require('../lib/proxy'),
  logger = require('../lib/logger');

const start = env => {
  const port = env.PORT || 3333;
  const app = express();

  const gateway = new Gateway({
    url: env.MARKETPLACE_URL,
    token: env.MARKETPLACE_TOKEN,
    email: env.MARKETPLACE_EMAIL
  });

  const graphqlRouting = (req, res) => {
    gateway
      .graph(req.body)
      .then(body => res.send(body))
      .catch(error => res.send(error));
  };

  const liquidRouting = (req, res) => {
    gateway
      .liquid(req.body)
      .then(body => res.send(body))
      .catch(error => res.send(error));
  };
  app.use(bodyParser.json());
  app.use(compression());

  app.use('/gui/editor', express.static(path.resolve(__dirname, '..', 'gui', 'editor', 'public')));
  app.use('/gui/graphql', express.static(path.resolve(__dirname, '..', 'gui', 'graphql', 'public')));
  app.use('/gui/liquid', express.static(path.resolve(__dirname, '..', 'gui', 'liquid', 'public')));

  // INFO
  const info = (req, res) => {
    return res.send(JSON.stringify({ MPKIT_URL: env.MARKETPLACE_URL }));
  };

  app.get('/info', info);
  app.post('/graphql', graphqlRouting);
  app.post('/api/graph', graphqlRouting);
  app.post('/api/liquid', liquidRouting);
  app.get('/api/liquid', liquidRouting);

  // SYNC
  app.put(
    '/api/marketplace_builder/marketplace_releases/sync',
    upload.fields([{ name: 'path' }, { name: 'marketplace_builder_file_body' }]),
    (req, res) => {
      const formData = {
        path: req.body.path,
        marketplace_builder_file_body: req.files.marketplace_builder_file_body[0].buffer
      };

      gateway
        .sync(formData)
        .then(body => res.send(body))
        .catch(error => res.send(error));
    }
  );

  app
    .listen(port, function() {
      logger.Debug(`Server is listening on ${port}`);
      logger.Success(`Connected to ${env.MARKETPLACE_URL}`);
      logger.Success(`GraphiQL IDE: http://localhost:${port}/gui/graphql`);
      logger.Success(`Liquid evaluator: http://localhost:${port}/gui/liquid`);
    })
    .on('error', err => {
      if (err.errno === 'EADDRINUSE') {
        logger.Error(`Port ${port} is already in use.`, { exit: false });
        logger.Print('\n');
        logger.Warn('Please use -p <port> to run server on a different port.\n');
        logger.Warn('Example: pos-cli gui serve staging -p 31337');
      } else {
        logger.Error(`Something wrong happened when trying to run Express server: ${err}`);
      }
    });
};

module.exports = {
  start: start
};
