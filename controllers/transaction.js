const db = require('../db');
const chance = require('chance').Chance();
const md5 = require('md5');
const utils = require('../utils');
const config = require('../config');
const sequelize = require('sequelize');
const moment = require('moment');
const _ = require('lodash');

const Op = sequelize.Op;
const models = db.models;

// GET /user/transactions
exports.getUsertransactions = async function getUsertransactions(ctx) {
  const user = await ctx.auth();

  let limit = parseInt(ctx.query.limit || 50, 10);
  limit = limit > 50 ? 50 : limit;
  const offset = parseInt(ctx.query.offset || 0, 10);

  const option = {
    limit,
    offset,
    where: {
      userId: user.id,
    },
    order: [
      ['updatedAt', 'DESC'],
    ],
  };

  ctx.body = await models.transaction.findAll(option);
  const count = await models.transaction.count({
    where: option.where,
  });
  ctx.state.noPack = true;
  ctx.body = {
    limit,
    offset,
    statusCode: 200,
    result: ctx.body,
    count,
  };
};
