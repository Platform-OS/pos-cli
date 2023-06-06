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
  const next = express();

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

  // Enable cors for Editor in Dev mode
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  next.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  app.use('/', express.static(path.resolve(__dirname, '..', 'gui', 'admin', 'dist')));
  app.use('/gui/graphql', express.static(path.resolve(__dirname, '..', 'gui', 'graphql', 'public')));
  app.use('/gui/liquid', express.static(path.resolve(__dirname, '..', 'gui', 'liquid', 'public')));

  next.use('/', express.static(path.resolve(__dirname, '..', 'gui', 'next', 'build')));

  // INFO
  const info = (req, res) => {
    return res.send(JSON.stringify({ MPKIT_URL: env.MARKETPLACE_URL }));
  };

  app.get('/info', info);
  app.post('/graphql', graphqlRouting);
  app.post('/api/graph', graphqlRouting);
  app.post('/api/liquid', liquidRouting);
  app.get('/api/liquid', liquidRouting);

  app.get('/api/logs', (req, res) => {
    gateway
      .logs({ lastId: req.query.lastId })
      .then(body => res.send(body))
      .catch(error => res.send(error));
  });

  // catch 404s and redirect to editor
  app.get('/*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'gui', 'admin', 'dist', '__app.html'));
  });

  // SYNC
  app.put(
    '/api/app_builder/marketplace_releases/sync',
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
      logger.Success(`Admin: http://localhost:${port}`);
      logger.Success(`---`);
      logger.Success(`GraphiQL IDE: http://localhost:${port}/gui/graphql`);
      logger.Success(`Liquid evaluator: http://localhost:${port}/gui/liquid`);
      logger.Success(`Instance Logs: http://localhost:${port}/Logs`);
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

  next
    .listen(3334, function() {
      logger.News(`New admin panel preview: http://localhost:3334`);
    })
    .on('error', err => {
      logger.Error(`Could not run the new admin panel preview at http://localhost:3334`);
    });
};

module.exports = {
  start: start
};
