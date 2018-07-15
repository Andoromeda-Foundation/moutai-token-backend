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

// GET /spirits/{id}/trades
exports.getSpiritTrades = async function getSpiritTrades(ctx) {
  const spirit = await models.spirit.find({
    where: {
      id: ctx.params.id,
    },
    include: [{
      model: models.user,
    }],
  });
  ctx.assert(spirit, 404);

  const trades = await models.trade.findAll({
    where: {
      spiritId: spirit.id,
    },
    include: [{
      model: models.user,
      as: 'fromUser',
      attributes: config.userPublicAttributes,
    }, {
      model: models.user,
      as: 'toUser',
      attributes: config.userPublicAttributes,
    }],
    order: [
      ['createdAt', 'DESC'],
    ],
  });

  ctx.body = trades;
};

// GET /user/trades
exports.getUserTrades = async function getUserTrades(ctx) {
  let limit = parseInt(ctx.query.limit || 50, 10);
  limit = limit > 50 ? 50 : limit;
  const offset = parseInt(ctx.query.offset || 0, 10);

  const user = await ctx.auth();

  const option = {
    limit,
    offset,
    where: {
      [Op.or]: [{
        fromUserId: user.id,
      }, {
        toUserId: user.id,
      }],
    },
    include: [{
      model: models.spirit,
    }, {
      model: models.user,
      as: 'fromUser',
      attributes: config.userPublicAttributes,
    }, {
      model: models.user,
      as: 'toUser',
      attributes: config.userPublicAttributes,
    }],
    order: [
      ['createdAt', 'DESC'],
    ],
  };

  if (ctx.query.spiritId) {
    option.where.spiritId = parseInt(ctx.query.spiritId, 10);
  }

  const trades = await models.trade.findAll(option);

  ctx.body = trades.map((trade) => {
    const data = trade.toJSON();
    data.isCurrentUserSell = data.fromUserId === user.id;
    data.isCurrentUserBuy = data.toUserId === user.id;

    return data;
  });
};
