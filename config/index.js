const process = require('process');
const copy = require('copy-to');
const defaultConfig = require('./default');
const releaseConfig = require('./release');
const productionConfig = require('./production');

copy(defaultConfig).to(module.exports);

exports.env = process.env.NODE_ENV ? process.env.NODE_ENV : 'dev';

if (exports.env === 'release') {
  copy(releaseConfig).toCover(module.exports);
}

if (exports.env === 'production') {
  copy(productionConfig).toCover(module.exports);
}
