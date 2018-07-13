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

// GET /spirits
exports.getSpirits = async function getSpirits(ctx) {
  let limit = parseInt(ctx.query.limit || 50, 10);
  limit = limit > 50 ? 50 : limit;
  const offset = parseInt(ctx.query.offset || 0, 10);

  const option = {
    limit,
    offset,
    where: {
      status: 'normal',
    },
    include: [{
      model: models.user,
      attributes: config.userPublicAttributes,
    }],
    order: [
      ['updatedAt', 'DESC'],
    ],
  };

  option.where = _.assign(option.where, _.pick(ctx.query, ['status', 'brand', 'region', 'time', 'degree', 'specification']));

  const spirits = await models.spirit.findAll(option);
  const count = await models.spirit.count({
    where: option.where,
  });
  ctx.state.noPack = true;
  ctx.body = {
    limit,
    offset,
    statusCode: 200,
    result: spirits,
    count,
  };
};

// GET /spirits/{id}
exports.getSpiritById = async function getSpiritById(ctx) {
  const spirit = await models.spirit.find({
    where: {
      id: ctx.params.id,
    },
    include: [{
      model: models.user,
      attributes: config.userPublicAttributes,
    }],
  });
  ctx.assert(spirit, 404);

  ctx.body = spirit;
};

// POST /spirits/{id}/buy
exports.buy = async function buy(ctx) {
  const user = await ctx.auth();
  const price = ctx.request.body.price;

  const spirit = await models.spirit.find({
    where: {
      id: ctx.params.id,
    },
    include: [{
      model: models.user,
      attributes: config.userPublicAttributes,
    }],
  });
  ctx.assert(spirit, 404);

  const fromUserId = spirit.userId;
  const toUserId = user.id;

  ctx.assert(price >= spirit.nextPrice, '出价小于最低可出价格');
  ctx.assert(user.balance >= price, '用户余额不足');

  // 买家扣款
  await models.user.increment({
    balance: -price,
  }, {
    where: {
      id: toUserId,
    },
  });
  await models.transaction.create({
    type: 'expense',
    amount: price,
    description: `购酒扣款 #${spirit.id} ${spirit.title}`,
    userId: toUserId,
  });

  // 酒信息更新
  const trade = await models.trade.create({
    price,
    fromUserId,
    toUserId,
    spiritId: spirit.id,
  });

  const history = spirit.history;
  history.push({
    action: 'trade',
    fromUserId,
    toUserId,
    tradeId: trade.id,
    time: moment().toISOString(),
  });

  const nextPrice = price * (1 + config.nextPriceIncreaseFactor);

  await spirit.update({
    currentPrice: price,
    nextPrice,
    userId: toUserId,
    history,
  });

  // 给卖家增加余额
  await models.user.increment({
    balance: price,
  }, {
    where: {
      id: fromUserId,
    },
  });
  await models.transaction.create({
    type: 'income',
    amount: price,
    description: `卖酒所得 #${spirit.id} ${spirit.title}`,
    userId: fromUserId,
  });

  // 重新获取酒的信息
  ctx.body = await models.spirit.find({
    where: {
      id: ctx.params.id,
    },
    include: [{
      model: models.user,
      attributes: config.userPublicAttributes,
    }],
  });
};
