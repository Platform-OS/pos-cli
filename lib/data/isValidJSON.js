const isValidJSON = data => {
  try {
    JSON.parse(data);
    return true;
  } catch (e) {
    return false;
  }
};

export default isValidJSON;
