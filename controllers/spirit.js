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
      status: 'sale',
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

// GET /user/spirits
exports.getUserSpirits = async function getUserSpirits(ctx) {
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
  ctx.assert(spirit.status === 'sale', 400, '此瓶酒不在出售状态');

  const oldPrice = spirit.currentPrice;
  const currentPrice = ctx.request.body.price;

  const fromUserId = spirit.userId;
  const toUserId = user.id;

  ctx.assert(currentPrice >= spirit.nextPrice, '出价小于最低可出价格');
  ctx.assert(user.balance >= currentPrice, '用户余额不足');

  // 买家扣款
  await models.user.increment({
    balance: -currentPrice,
    assetCount: 1,
    assetValue: currentPrice,
  }, {
    where: {
      id: toUserId,
    },
  });
  await models.transaction.create({
    type: 'expense',
    status: 'success',
    amount: currentPrice,
    description: `购酒扣款 #${spirit.id} ${spirit.title}`,
    userId: toUserId,
  });

  // 酒信息更新
  const trade = await models.trade.create({
    price: currentPrice,
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

  const nextPrice = currentPrice * (1 + config.nextPriceIncreaseFactor);

  await spirit.update({
    currentPrice,
    nextPrice,
    userId: toUserId,
    history,
  });

  // 给卖家增加余额
  await models.user.increment({
    balance: currentPrice,
    assetCount: -1,
    assetValue: -oldPrice,
  }, {
    where: {
      id: fromUserId,
    },
  });
  await models.transaction.create({
    type: 'income',
    success: 'success',
    amount: currentPrice,
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

// PATCH /spirits/{id}
exports.updateSpirit = async function updateSpirit(ctx) {
  const user = await ctx.auth();

  const spirit = await models.spirit.find({
    where: {
      id: ctx.params.id,
    },
  });
  ctx.assert(spirit, 404);
  ctx.assert(spirit.userId === user.id, 400, '只能修改自己的酒的状态');

  const update = {};
  if (ctx.request.body.status) {
    ctx.assert(ctx.request.body.status === 'sale' || ctx.request.body.status === 'normal', 400, '无效状态');
    update.status = ctx.request.body.status;
  }
  if (ctx.request.body.nextPrice) {
    ctx.assert(ctx.request.body.nextPrice > 0, 400, '价格有误');
    update.nextPrice = ctx.request.body.nextPrice;
  }

  await spirit.update(update);

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
