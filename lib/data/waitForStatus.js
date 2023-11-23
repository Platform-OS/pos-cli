const logger = require('../logger');

const waitForStatus = (statusCheck, pendingStatus, successStatus, interval = 1500) => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      statusCheck()
        .then(response => {
          try {
            const status = response.status;
            if (status === pendingStatus)
              setTimeout(getStatus, interval);
            else if (status === successStatus)
              resolve(response);
            else
              reject(response);
          }
          catch(e) { reject(e) }
    })
        .catch((error) => {
          logger.Debug('[ERR] waitForStatus did not receive `status` in response object', error);
          reject(error);
        });
    })();
  });
};


module.exports = waitForStatus;
