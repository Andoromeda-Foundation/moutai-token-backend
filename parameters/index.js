const yaml = require('js-yaml');
const fs = require('fs-extra');
const path = require('path');

exports.test = yaml.safeLoad(fs.readFileSync(path.join(__dirname, 'test.yaml'), 'utf8'));
