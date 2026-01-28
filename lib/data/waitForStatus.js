import logger from '../logger.js';

const waitForStatus = (statusCheck, pendingStatus, successStatus, interval = 5000, cb = null) => {
  return new Promise((resolve, reject) => {
    let getStatus = () => {
      statusCheck()
        .then(response => {
          try {
            const status = response.status.name || response.status;
            if (cb) cb(response);
            if (pendingStatus.includes(status))
              setTimeout(getStatus, interval);
            else if (status === successStatus)
              resolve(response);
            else if (status === 'failed')
              reject(response);
            else
              setTimeout(getStatus, interval);
          } catch(e) {
            reject(e); 
          }
        })
        .catch((error) => {
          logger.Debug('[ERR] waitForStatus did not receive `status` in response object', error);
          reject(error);
        });
    };
    getStatus();
  });
};


export default waitForStatus;
