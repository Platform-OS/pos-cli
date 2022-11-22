const logger = require('../logger');

const waitForStatus = (statusCheck, pendingStatus, successStatus) => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      statusCheck().then(response => {
        const status = response.status;
        if (status) {
          // if (status === 'pending' || status === 'ready_for_export') {
          if (status === pendingStatus) {
            setTimeout(getStatus, 1500);
          // } else if (status === 'done' || status === 'success') {
          } else if (status === successStatus) {
            resolve(response);
          } else {
            reject(response);
          }
        } else {
          reject(response);
        }
      }).catch((error) => {
        logger.Debug('[ERR] waitForStatus did not receive `status` in response object', error);
        reject(error);
      });
    })();
  });
};


module.exports = waitForStatus;
