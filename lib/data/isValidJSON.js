// TODO: Move to validators...
const isValidJSON = data => {
  try {
    JSON.parse(data);
    // TODO check required keyes
    return true;
  } catch (e) {
    return false;
  }
};

module.exports = isValidJSON;
