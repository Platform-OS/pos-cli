const logger = require('../logger');

const waitForStatus = (statusCheck) => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      statusCheck().then(response => {
        if (response.status) {
          if (response.status === 'pending' || response.status === 'ready_for_export') {
            setTimeout(getStatus, 1500);
          } else if (response.status === 'done' || response.status === 'success') {
            resolve(response);
          }
        }
      }).catch((error) => {
        logger.Debug('[ERR] waitForStatus did not receive `status` in response object', error);
      });
    })();
  });
};


module.exports = waitForStatus;
