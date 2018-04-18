#!/usr/bin/env node

const port = process.env.PORT || 3333;
const fs = require('fs');

const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
const Gateway = require('./lib/proxy');

const app = express();

const gateway = new Gateway({
  url: process.env.MARKETPLACE_URL,
  token: process.env.MARKETPLACE_TOKEN,
  email: process.env.MARKETPLACE_EMAIL
});

app.use(bodyParser.json());
app.use('/gui', express.static(__dirname + '/gui/public'));

// GRAPHQL
app.post('/api/graph', (request, response) => {
  gateway.graph(request.body.query)
    .then(
      body => response.send(body),
      error => response.status(401).send(error.statusText)
    );
});

// SYNC
app.put(
  '/api/marketplace_builder/marketplace_releases/sync',
  upload.fields([{ name: 'path' }, { name: 'marketplace_builder_file_body' }]),
  (request, response) => {
    const form = {
      path: request.body.path,
      marketplace_builder_file_body: request.files.marketplace_builder_file_body[0].buffer
    };

    gateway.sync(form).then(
      body => response.send(body),
      error => response.send(error)
    );
  }
);

app.listen(port, err => {
  if (err) {
    return console.log('something wrong happened', err);
  }

  console.log(`server is listening on ${port}`);
  console.log(`http://localhost:${port}/gui`);
});
