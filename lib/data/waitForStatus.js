const waitForStatus = (id, statusEndpoint) => {
  return new Promise((resolve, reject) => {
    (getStatus = () => {
      statusEndpoint(id).then(response => {
        if (response.status === 'pending') {
          setTimeout(getStatus, 1500);
        } else if (response.status === 'done') {
          resolve(response);
        } else {
          reject('error');
        }
      });
    })();
  });
};


module.exports = waitForStatus;
