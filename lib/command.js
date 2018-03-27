const command = (commandText) => {
  return /^win/.test(process.platform) ? `${commandText}.cmd` : commandText;
};

module.exports = command;
