import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import { fileURLToPath } from 'url';
import pkg from '../package.json' with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const version = pkg.version;

const upload = multer();

import Gateway from '../lib/proxy.js';
import logger from '../lib/logger.js';

const start = (env, client) => {
  const port = env.PORT || 3333;
  const app = express();
  const legacy = express();

  const gateway = new Gateway({
    url: env.MARKETPLACE_URL,
    token: env.MARKETPLACE_TOKEN,
    email: env.MARKETPLACE_EMAIL,
  }, client);

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

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  legacy.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  app.use('/', express.static(path.resolve(__dirname, '..', 'gui', 'next', 'build')));
  app.use('/gui/graphql', express.static(path.resolve(__dirname, '..', 'gui', 'graphql', 'public')));
  app.use('/gui/liquid', express.static(path.resolve(__dirname, '..', 'gui', 'liquid', 'public')));

  legacy.use('/', express.static(path.resolve(__dirname, '..', 'gui', 'admin', 'dist')));

  const info = (req, res) => {
    return res.send(JSON.stringify({ MPKIT_URL: env.MARKETPLACE_URL, version: version }));
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

  app.get('/api/logsv2', (req, res) => {
    gateway
      .logsv2({ ...req.query })
      .then(body => { res.send(body) })
      .catch(error => { logger.Debug(error); res.send(error) });
  });

  app.post('/api/logsv2', (req, res) => {
    gateway
      .logsv2(req.body)
      .then(body => { res.send(body) })
      .catch(error => { logger.Debug(error); res.send(error) });
  });

  app.get('/*splat', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'gui', 'next', 'build', 'index.html'));
  });

  legacy.get('/*splat', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'gui', 'admin', 'dist', '__app.html'));
  });

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
      logger.Success(`Instance Logs: http://localhost:${port}/logs`);
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

  legacy
    .listen(parseInt(port)+1, function(){})
    .on('error', err => {
      logger.Error(`Could not run the legacy admin panel at http://localhost:${parseInt(port)+1}`);
    });
};

export { start };
