import logger from '../logger.js';

const waitForStatus = (statusCheck, pendingStatus, successStatus, interval = 5000, cb = null) => {
  return new Promise((resolve, reject) => {
    let pollCount = 0;
    let getStatus = () => {
      pollCount++;
      statusCheck()
        .then(response => {
          try {
            logger.Debug(`[waitForStatus] Poll #${pollCount}, response: ${JSON.stringify(response)}`);
            const status = response.status.name || response.status;
            logger.Debug(`[waitForStatus] Status: ${status}, pending: ${pendingStatus.includes(status)}, success: ${status === successStatus}`);
            if (cb) cb(response);
            if (pendingStatus.includes(status))
              setTimeout(getStatus, interval);
            else if (status === successStatus) {
              logger.Debug(`[waitForStatus] Success, resolving with access_token: ${response.access_token}`);
              resolve(response);
            }
            else if (status === 'failed') {
              logger.Debug(`[waitForStatus] Failed with status: ${status}`);
              reject(response);
            }
            else {
              logger.Debug(`[waitForStatus] Unknown status: ${status}, continuing poll`);
              setTimeout(getStatus, interval);
            }
          } catch(e) {
            logger.Debug(`[waitForStatus] Error processing response: ${e.message}`);
            reject(e);
          }
        })
        .catch((error) => {
          logger.Debug('[waitForStatus] Poll error', error);
          reject(error);
        });
    };
    logger.Debug(`[waitForStatus] Starting poll, interval: ${interval}ms`);
    getStatus();
  });
};


export default waitForStatus;
