const io = require("socket.io-client"),
  url = require("url"),
  request = require("request"),
  fs = require("fs"),
  logger = require("../lib/kit").logger,
  mime = require("mime"),
  readdirp = require("readdirp");

const directoriesToIgnore = ["!.git", "!node_modules"];
const assetsDirectory = "marketplace_builder/assets";
const assetsManifestFile = "marketplace_builder/assets.json";

const uploadManifest = assetsHash => {
  return new Promise(function(resolve, reject) {
    fs.writeFile(
      assetsManifestFile,
      JSON.stringify(assetsHash),
      "utf8",
      err => {
        if (err) reject(err);
        else resolve(true);
      }
    );
  });
};

const uploadFile = (fileName, s3Url) => {
  var stats = fs.statSync(fileName);
  return new Promise((resolve, reject) => {
    fs.createReadStream(fileName).pipe(
      request
        .put({
          url: s3Url,
          headers: {
            "Content-Type": mime.getType(fileName),
            "Content-Length": stats["size"]
          }
        })
        .on("error", e => reject(e))
        .on("end", () => resolve())
    );
  });
};

const sendRequestsForPresignedUrls = (socket, assets) => {
  readdirp({
    root: assetsDirectory,
    directoryFilter: directoriesToIgnore
  })
    .on("data", entry => {
      var fileName = `${assetsDirectory}/${entry.path}`;
      assets.push({
        fileName: fileName,
        contentLength: fs.statSync(fileName)["size"],
        contentType: mime.getType(fileName)
      });
    })
    .on("end", () => socket.emit("deploy:presign", { urls: assets }));
};

const initializeConnection = () => {
  return new Promise((resolve, reject) => {
    try {
      var serviceUrl = new url.URL(process.env.MARKETPLACE_URL);

      if (!process.env.DEPLOY_SERVICE_URL) {
        // Make it possible to set DEPLOY_SERVICE_URL without
        // depending on Load Balancer settings
        serviceUrl = process.env.DEPLOY_SERVICE_URL;
      } else {
        // We have one deploy-service per environent hosted at URI /deploy-service.*
        serviceUrl.pathname = "/deploy-service";
        serviceUrl = serviceUrl.href;
      }
      logger.Info(`Connecting to ${serviceUrl}`);
      return resolve(
        io.connect(
          serviceUrl,
          {
            extraHeaders: {
              token: process.env.MARKETPLACE_TOKEN,
              marketplace_domain: url.parse(process.env.MARKETPLACE_URL)
                .hostname
            }
          }
        )
      );
    } catch (e) {
      reject(e);
    }
  });
};

const presignUrlsAndUploadFiles = () => {
  return new Promise((resolve, reject) => {
    var assets = [];
    var uploaded = {};

    initializeConnection().then(
      socket => {
        socket.on("connect_error", err =>
          reject(`[DeployService] Connection atempt failed ${err}`)
        );

        socket.on("connect_timeout", () =>
          reject("[DeployService] Connection atempt failed (timeout)")
        );

        socket.on("error", err => reject(err));

        socket.on("connect", () => {
          logger.Info("[DeployService] Connected requesting presigned S3 urls");
          sendRequestsForPresignedUrls(socket, assets);
        });

        socket.on("deploy:url", data => {
          uploadFile(data.fileName, data.url, data.accessUrl)
            .then(
              () => {
                logger.Print(".");
                uploaded[data.fileName] = data.accessUrl;
                assets = assets.filter(i => i.fileName !== data.fileName);
                if (assets.length == 0) {
                  logger.Print("\n");
                  uploadManifest(uploaded).then(
                    () => {
                      setTimeout(() => {
                        socket.disconnect();
                        return resolve(true);
                      }, 10000);
                    },
                    err => reject(err)
                  );
                }
              },
              err => reject(err)
            )
            .catch(err => reject(err));
        });
      },
      err => reject(err)
    );
  });
};

const deployAssets = () => {
  return presignUrlsAndUploadFiles();
};

module.exports = {
  deployAssets: deployAssets
};
