const isWindows =  /^win/.test(process.platform);
const bin = isWindows ? `node ${process.cwd()}\\bin\\pos-cli.js` : `${process.cwd()}/bin/pos-cli.js`;

module.exports = bin;
