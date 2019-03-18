const io = require('socket.io-client'),
  url = require('url'),
  request = require('request'),
  fs = require('fs'),
  logger = require('../lib/logger'),
  uploadFile = require('./s3UploadFile'),
  mime = require('mime'),
  readdirp = require('readdirp');

const directoriesToIgnore = ['!.git', '!node_modules'];
const assetsDirectory = 'marketplace_builder/assets';
const assetsManifestFile = 'marketplace_builder/assets.json';

const uploadManifest = assetsHash => {
  return new Promise(function(resolve, reject) {
    fs.writeFile(assetsManifestFile, JSON.stringify(assetsHash), 'utf8', err => {
      if (err) reject(err);
      else resolve(true);
    });
  });
};

const sendRequestsForPresignedUrls = (socket, assets, remoteAssetsDirectory) => {
  readdirp({
    root: assetsDirectory,
    directoryFilter: directoriesToIgnore
  })
    .on('data', entry => {
      const fileName = `${remoteAssetsDirectory}/${entry.path}`;
      const localFileName = `${assetsDirectory}/${entry.path}`;
      assets.push({
        fileName: fileName,
        contentLength: fs.statSync(localFileName)['size'],
        contentType: mime.getType(localFileName)
      });
    })
    .on('end', () => socket.emit('deploy:presign', { urls: assets }));
};

const initializeConnection = () => {
  return new Promise((resolve, reject) => {
    try {
      const serviceUrl = deployServiceUrl();
      logger.Debug(`Connecting to ${serviceUrl}`);
      return resolve(
        io.connect(
          serviceUrl,
          {
            extraHeaders: {
              token: process.env.MARKETPLACE_TOKEN,
              marketplace_domain: url.parse(process.env.MARKETPLACE_URL).hostname
            },
            // transports: ['websocket'], # uncomment once our loadbalancer support websockets!!!
            path: '/api/private/urls/socket.io'
          }
        )
      );
    } catch (e) {
      reject(e);
    }
  });
};

const deployServiceUrl = () => {
  let serviceUrl = new url.URL(process.env.MARKETPLACE_URL);

  if (process.env.DEPLOY_SERVICE_URL) {
    serviceUrl = process.env.DEPLOY_SERVICE_URL;
  } else {
    serviceUrl.pathname = '/api/private/urls';
    serviceUrl = serviceUrl.href;
  }
  return serviceUrl;
};

const presignUrlsAndUploadFiles = (instanceId) => {
  return new Promise((resolve, reject) => {
    var assets = [];
    var uploaded = {};
    const remoteAssetsDirectory = `instances/${instanceId}/assets`;

    initializeConnection().then(socket => {
      socket.on('connect_error', err => {
        reject(`[DeployService] Connection attempt failed ${err}`);
      });

      socket.on('connect_timeout', () => reject('[DeployService] Connection attempt failed (timeout)'));

      socket.on('error', err => reject(err));

      socket.on('connect', () => {
        logger.Debug('[DeployService] Connected requesting presigned S3 urls');
        sendRequestsForPresignedUrls(socket, assets, remoteAssetsDirectory);
      });

      socket.on('deploy:url', data => {
        const localFileName = data.fileName.replace(remoteAssetsDirectory, assetsDirectory);
        uploadFile(localFileName, data.url)
          .then(() => {
            logger.Print('.');
            uploaded[localFileName] = {
              url: data.accessUrl,
              path: data.fileName,
              updated_at: ((new Date()).getTime()/1000|0)
            };
            assets = assets.filter(i => i.fileName !== data.fileName);
            if (assets.length == 0) {
              logger.Print('\n');
              uploadManifest(uploaded).then(() => {
                setTimeout(() => {
                  socket.disconnect();
                  return resolve(true);
                }, 10000);
              }, reject);
            }
          }, reject)
          .catch(reject);
      });
    }, reject);
  });
};

const deployAssets = (gateway) => {
  return gateway.getInstance().then(response => {
    return presignUrlsAndUploadFiles(response.id);
  });
};

module.exports = {
  deployAssets: deployAssets
};
