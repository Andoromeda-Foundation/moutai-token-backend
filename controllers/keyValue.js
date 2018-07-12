const db = require('../db');
const chance = require('chance').Chance();
const md5 = require('md5');
const utils = require('../utils');
const config = require('../config');

const models = db.models;

// GET /keyValues/{key}
exports.getKeyValue = async function getKeyValue(ctx) {
  const keyValue = await models.keyValue.find({
    where: {
      key: ctx.params.key,
    },
  });

  ctx.assert(keyValue, 404);

  ctx.body = keyValue;
};
