const isValidJSON = data => {
  try {
    JSON.parse(data);
    return true;
  } catch {
    return false;
  }
};

export default isValidJSON;
