import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import pkg from '../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const version = pkg.version;

const upload = multer();

import Gateway from '../lib/proxy.js';
import logger from '../lib/logger.js';
import { validate } from '../lib/validation/index.js';
import {
  graphqlRequestSchema,
  liquidRequestSchema,
  logsRequestSchema,
  logsSearchSchema,
  syncRequestSchema
} from '../lib/validation/schemas/gui.js';

const start = (env, client) => {
  const port = env.PORT || 3333;
  const host = env.HOST || 'localhost';
  const app = express();

  const gateway = new Gateway({
    url: env.MARKETPLACE_URL,
    token: env.MARKETPLACE_TOKEN,
    email: env.MARKETPLACE_EMAIL
  }, client);

  // Gateway rejections are Error instances, so `res.send(error)` serialised them to `{}`
  // under a 200 — the GUI saw a successful but empty response and then threw on the fields
  // it expected. Forward the upstream status with the upstream body instead, and always as
  // JSON so no error text is ever handed back for a browser to parse as HTML.
  const sendError = (res, error) => {
    const status = error?.statusCode || error?.response?.statusCode || 502;
    const body = error?.response?.body;

    if (body && typeof body === 'object') return res.status(status).json(body);
    return res.status(status).json({ error: (typeof body === 'string' && body) || error?.message || 'Request failed' });
  };

  // Rejects the request when `payload` does not match `schema`, and reports which field
  // was at fault so the GUI shows something more useful than an upstream 500.
  const rejectInvalid = (res, schema, payload, { mode = 'strict' } = {}) => {
    const result = validate(schema, payload, { mode });
    if (result.valid) return false;

    // A schema that will not compile is our defect, not the caller's — report it as a
    // server error, but still reject, since nothing was actually checked.
    const status = result.schemaError ? 500 : 400;

    logger.Debug(`Rejected invalid request: ${result.message}`);
    res.status(status).json({ error: `Invalid request: ${result.message}`, details: result.errors });
    return true;
  };

  const graphqlRouting = (req, res) => {
    if (rejectInvalid(res, graphqlRequestSchema, req.body)) return;

    gateway
      .graph(req.body)
      .then(body => res.send(body))
      .catch(error => sendError(res, error));
  };

  // POST carries the template as a JSON body; the form in gui/liquid falls back to a GET
  // with `?content=...`, so the payload has to be read from whichever the request used.
  const liquidRouting = (req, res) => {
    const payload = req.method === 'GET' ? req.query : req.body;
    if (rejectInvalid(res, liquidRequestSchema, payload)) return;

    gateway
      .liquid(payload)
      .then(body => res.send(body))
      .catch(error => sendError(res, error));
  };
  app.use(bodyParser.json());

  // A ceiling on abuse, not a throttle on normal use: one GUI page load pulls dozens of
  // static assets through the catch-all route, so the limit has to sit far above anything
  // a developer clicking around can reach.
  app.use(rateLimit({
    windowMs: 60 * 1000,
    limit: 2000,
    standardHeaders: true,
    legacyHeaders: false
  }));

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  app.use('/', express.static(path.resolve(__dirname, '..', 'gui', 'next', 'build')));
  app.use('/gui/graphql', express.static(path.resolve(__dirname, '..', 'gui', 'graphql', 'public')));
  app.use('/gui/liquid', express.static(path.resolve(__dirname, '..', 'gui', 'liquid', 'public')));

  const info = (req, res) => {
    return res.send(JSON.stringify({ MPKIT_URL: env.MARKETPLACE_URL, version: version }));
  };

  app.get('/info', info);
  app.post('/graphql', graphqlRouting);
  app.post('/api/graph', graphqlRouting);
  app.post('/api/liquid', liquidRouting);
  app.get('/api/liquid', liquidRouting);

  app.get('/api/logs', (req, res) => {
    const params = { ...req.query };
    if (rejectInvalid(res, logsRequestSchema, params, { mode: 'coercing' })) return;

    gateway
      .logs({ lastId: params.lastId })
      .then(body => res.send(body))
      .catch(error => sendError(res, error));
  });

  // Coercing mode on both verbs: the GET route can only deliver strings, and a POST body
  // that spells a numeric field as a string is normalised rather than rejected.
  app.get('/api/logsv2', (req, res) => {
    const params = { ...req.query };
    if (rejectInvalid(res, logsSearchSchema, params, { mode: 'coercing' })) return;

    gateway
      .logsv2(params)
      .then(body => {
        res.send(body);
      })
      .catch(error => {
        logger.Debug(error); sendError(res, error);
      });
  });

  app.post('/api/logsv2', (req, res) => {
    if (rejectInvalid(res, logsSearchSchema, req.body, { mode: 'coercing' })) return;

    gateway
      .logsv2(req.body)
      .then(body => {
        res.send(body);
      })
      .catch(error => {
        logger.Debug(error); sendError(res, error);
      });
  });

  app.get('/*splat', (req, res) => {
    res.sendFile('index.html', { root: path.resolve(__dirname, '..', 'gui', 'next', 'build') });
  });

  app.put(
    '/api/app_builder/marketplace_releases/sync',
    upload.fields([{ name: 'path' }, { name: 'marketplace_builder_file_body' }]),
    (req, res) => {
      if (rejectInvalid(res, syncRequestSchema, req.body)) return;

      // The upload arrives through multer rather than the JSON body, so it is guarded
      // here instead of in the schema. Without this the missing-field case dereferenced
      // undefined and surfaced as an unhandled 500.
      const uploaded = req.files?.marketplace_builder_file_body?.[0];
      if (!uploaded) {
        return res.status(400).json({ error: 'Invalid request: missing file field marketplace_builder_file_body' });
      }

      const formData = {
        path: req.body.path,
        marketplace_builder_file_body: uploaded.buffer
      };

      gateway
        .sync(formData)
        .then(body => res.send(body))
        .catch(error => sendError(res, error));
    }
  );

  // Returned so callers (and tests) can shut the listener down.
  return app
    .listen(port, host, function() {
      logger.Debug(`Server is listening on ${port}`);
      logger.Success(`Connected to ${env.MARKETPLACE_URL}`);
      logger.Success(`Admin: http://${host}:${port}`);
      logger.Success('---');
      logger.Success(`GraphiQL IDE: http://${host}:${port}/gui/graphql`);
      logger.Success(`Liquid evaluator: http://${host}:${port}/gui/liquid`);
      logger.Success(`Instance Logs: http://${host}:${port}/logs`);
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

export { start };
