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

const getDetailTradeFun = async function getDetailTradeFun(
  id,
  isPrivate = false,
) {
  const attributes = isPrivate
    ? config.userPublicAttributes.concat(config.userTradeAttributes)
    : config.userPublicAttributes;

  const trade = await models.trade.find({
    where: {
      id,
    },
    include: [
      {
        model: models.user,
        as: 'cryptoFromUser',
        attributes,
      },
      {
        model: models.user,
        as: 'cryptoToUser',
        attributes,
      },
      {
        model: models.user,
        as: 'creator',
        attributes,
      },
    ],
  });

  return trade;
};

// GET /trades
exports.getTrades = async function getTrades(ctx) {
  let limit = parseInt(ctx.query.limit || 25, 10);
  limit = limit > 25 ? 25 : limit;
  const offset = parseInt(ctx.query.offset || 0, 10);
  const type = ctx.query.type === 'buy' ? 'buy' : 'sell';
  const category = ctx.query.category || 'eth';
  const currency = ctx.query.currency || 'cny';
  const region = ctx.query.region || 'cn';

  const option = {
    limit: limit * 3, // 取3倍数据进行排序
    offset,
    where: {
      status: 'normal',
      type,
      category,
      currency,
      region,
    },
    // 获取order之后再进行排序
    // order: [type === 'sell' ? ['floatingPrice', 'ASC'] : ['floatingPrice', 'DESC']],
    include: [
      {
        model: models.user,
        as: 'creator',
        attributes: config.userPublicAttributes,
      },
    ],
  };

  if (ctx.query.isUseAlipayPayment === 'true') {
    option.where.isUseAlipayPayment = true;
  }
  if (ctx.query.isUseWechatPayment === 'true') {
    option.where.isUseWechatPayment = true;
  }
  if (ctx.query.isUseBankCardPayment === 'true') {
    option.where.isUseBankCardPayment = true;
  }

  const referencePrice = await utils.crypto.getReferencePrice(
    category,
    currency,
  );

  // 【功能取消】实际价格高于设定最高价格，或小于最低价格，需隐藏订单
  // option.where.maxPrice = {
  //   [Op.or]: {
  //     [Op.eq]: null,
  //     [Op.gt]: sequelize.literal(`"trade"."floatingPrice" * ${currentPrice}`),
  //   },
  // };
  // option.where.minPrice = {
  //   [Op.or]: {
  //     [Op.eq]: null,
  //     [Op.lt]: sequelize.literal(`"trade"."floatingPrice" * ${currentPrice}`),
  //   },
  // };

  let trades = await models.trade.findAll(option);
  trades = trades.map(tx => {
    const data = tx.toJSON();
    data.currentPrice = utils.crypto.getCurrentPrice(data, referencePrice);
    return data;
  });

  // 排序、截取
  trades = trades.sort((a, b) => a.currentPrice - b.currentPrice);
  trades = trades.slice(0, limit);

  const count = await models.trade.count({
    where: option.where,
  });
  ctx.state.noPack = true;
  ctx.body = {
    limit,
    offset,
    statusCode: 200,
    result: trades,
    count,
  };
};

// GET /trades/{id}
exports.getTradeById = async function getTradeById(ctx) {
  let user = null;
  let trade = await getDetailTradeFun(ctx.params.id, false);
  ctx.assert(trade, 404);

  try {
    user = await ctx.auth();

    if (
      trade.cryptoFromUserId === user.id ||
      trade.cryptoToUserId === user.id
    ) {
      trade = await getDetailTradeFun(ctx.params.id, true);
    }
  } catch (error) {
    // ignore auth error
  }

  if (trade.status !== 'normal') {
    ctx.assert(
      user &&
        (trade.cryptoFromUserId === user.id ||
          trade.cryptoToUserId === user.id),
      400,
      '用户无查看权限',
    );
  } else {
    trade = trade.toJSON();
    const referencePrice = await utils.crypto.getReferencePrice(
      trade.category,
      trade.currency,
    );
    trade.currentPrice = utils.crypto.getCurrentPrice(trade, referencePrice);
  }

  ctx.body = trade;
};

// POST /user/trades
exports.createTrade = async function createTrade(ctx) {
  const user = await ctx.auth();

  ctx.assert(user.moneyPassword, 400, '用户没有设置资金密码');

  const type = ctx.request.body.type === 'buy' ? 'buy' : 'sell';
  const category = ctx.request.body.category || 'eth';
  const currency = ctx.request.body.currency || 'cny';
  const region = ctx.request.body.region || 'cn';

  const data = _.pick(ctx.request.body, [
    'floatingPrice',
    'maxPrice',
    'minPrice',
    'maxFiatAmount',
    'minFiatAmount',
    'payPeriod',
    'isUseAlipayPayment',
    'isUseWechatPayment',
    'isUseBankCardPayment',
    'comment',
  ]);
  data.type = type;
  data.category = category;
  data.region = region;
  data.currency = currency;
  data.isFollowFiatAmount = true;
  data.status = 'normal';
  data.creatorId = user.id;
  data.history = [
    {
      action: 'create',
      time: moment().toISOString(),
    },
  ];

  if (data.maxFiatAmount && data.minFiatAmount) {
    ctx.assert(
      ctx.request.body.maxFiatAmount >= ctx.request.body.minFiatAmount,
      400,
      '交易限额设置有误',
    );
  }

  if (data.maxPrice && data.minPrice) {
    ctx.assert(
      ctx.request.body.maxPrice >= ctx.request.body.minPrice,
      400,
      '交易价格限制设置有误',
    );
  }

  if (type === 'buy') {
    data.cryptoToUserId = user.id;
  } else {
    data.cryptoFromUserId = user.id;
  }

  if (data.isUseAlipayPayment) {
    ctx.assert(
      user.aliPayAccount &&
        user.aliPayAccount.name &&
        user.aliPayAccount.account,
      400,
      '用户支付宝支付信息不完整',
    );
  }

  if (data.isUseWechatPayment) {
    ctx.assert(
      user.wechatAccount &&
        user.wechatAccount.name &&
        user.wechatAccount.account,
      400,
      '用户微信支付信息不完整',
    );
  }

  if (data.isUseBankCardPayment) {
    ctx.assert(
      user.bankAccount && user.bankAccount.name && user.bankAccount.account,
      400,
      '用户银行支付信息不完整',
    );
  }

  let trade = await models.trade.create(data);
  trade = trade.toJSON();
  trade.creator = user.safe();
  const referencePrice = await utils.crypto.getReferencePrice(
    trade.category,
    trade.currency,
  );
  trade.currentPrice = utils.crypto.getCurrentPrice(trade, referencePrice);
  if (type === 'buy') {
    trade.cryptoToUser = user.safe();
  } else {
    trade.cryptoFromUser = user.safe();
  }

  ctx.body = trade;
};

// PATCH /trades/{id}
exports.updateTradeById = async function updateTradeById(ctx) {
  const user = await ctx.auth();
  const trade = await getDetailTradeFun(ctx.params.id, true);

  ctx.assert(trade, 404);

  ctx.assert(trade.status === 'withdraw', 400, '此挂单无法被修改');

  const update = _.pick(ctx.request.body, [
    'type',
    'category',
    'region',
    'currency',
    'floatingPrice',
    'maxPrice',
    'minPrice',
    'maxFiatAmount',
    'minFiatAmount',
    'payPeriod',
    'isUseAlipayPayment',
    'isUseWechatPayment',
    'isUseBankCardPayment',
    'comment',
  ]);

  const history = trade.history;
  history.push({
    action: 'update',
    time: moment().toISOString(),
  });
  update.history = history;

  await trade.update(update);

  ctx.body = trade.toJSON();
};

// GET /user/trades
exports.getUserTrades = async function getUserTrades(ctx) {
  const user = await ctx.auth();

  let limit = parseInt(ctx.query.limit || 25, 10);
  limit = limit > 25 ? 25 : limit;
  const offset = parseInt(ctx.query.offset || 0, 10);

  const option = {
    limit,
    offset,
    where: {
      [Op.or]: [
        {
          creatorId: user.id,
        },
        {
          cryptoFromUserId: user.id,
        },
        {
          cryptoToUserId: user.id,
        },
      ],
    },
    order: [['updatedAt', 'DESC']],
    include: [
      {
        model: models.user,
        as: 'cryptoFromUser',
        attributes: config.userPublicAttributes.concat(config.userTradeAttributes),
      },
      {
        model: models.user,
        as: 'cryptoToUser',
        attributes: config.userPublicAttributes.concat(config.userTradeAttributes),
      },
      {
        model: models.user,
        as: 'creator',
        attributes: config.userPublicAttributes.concat(config.userTradeAttributes),
      },
    ],
  };

  if (ctx.query.category) {
    option.where.category = ctx.query.category;
  }

  if (ctx.query.currency) {
    option.where.currency = ctx.query.currency;
  }

  if (ctx.query.region) {
    option.where.region = ctx.query.region;
  }

  if (ctx.query.status) {
    if (ctx.query.status === 'notAd') {
      option.where.status = {
        [Op.notIn]: ['normal', 'withdraw'],
      };
    } else if (ctx.query.status === 'ad') {
      option.where.status = {
        [Op.in]: ['normal', 'withdraw'],
      };
    } else if (ctx.query.status === 'ongoing') {
      option.where.status = {
        [Op.notIn]: ['canceled', 'normal', 'closed', 'withdraw'],
      };
    } else if (ctx.query.status === 'finished') {
      option.where.status = {
        [Op.in]: ['canceled', 'closed'],
      };
    } else {
      option.where.status = ctx.query.status;
    }
  }

  if (ctx.query.type) {
    const type = ctx.query.type === 'buy' ? 'buy' : 'sell';
    option.where.type = type;
  }

  ctx.body = await models.trade.findAll(option);
  ctx.body = ctx.body.map(tx => tx.toJSON());

  for (const tx of ctx.body) { // eslint-disable-line no-restricted-syntax
    if (tx.status === 'normal') {
      const referencePrice = await utils.crypto.getReferencePrice( // eslint-disable-line no-await-in-loop
        tx.category,
        tx.currency,
      );
      tx.currentPrice = utils.crypto.getCurrentPrice(tx, referencePrice);
    }
  }

  const count = await models.trade.count({
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

// POST /trades/{id}/withdraw
exports.withdraw = async function withdraw(ctx) {
  const user = await ctx.auth();

  const trade = await getDetailTradeFun(ctx.params.id, true);

  ctx.assert(trade, 404, '挂单不存在');
  ctx.assert(trade.status === 'normal', 400, '挂单状态异常无法修改');
  ctx.assert(trade.creatorId === user.id, 400, '用户非挂单创建者');

  const history = trade.history;
  history.push({
    action: 'withdraw',
    time: moment().toISOString(),
  });

  await trade.update({
    status: 'withdraw',
    history,
  });

  ctx.body = trade;
};

// POST /trades/{id}/reopen
exports.reopen = async function reopen(ctx) {
  const user = await ctx.auth();

  const trade = await getDetailTradeFun(ctx.params.id, true);

  ctx.assert(trade, 404, '挂单不存在');
  ctx.assert(trade.status === 'withdraw', 400, '挂单状态异常无法修改');
  ctx.assert(trade.creatorId === user.id, 400, '用户非挂单创建者');

  const history = trade.history;
  history.push({
    action: 'reopen',
    time: moment().toISOString(),
  });

  await trade.update({
    status: 'normal',
    history,
  });

  ctx.body = trade.toJSON();
  const referencePrice = await utils.crypto.getReferencePrice(
    trade.category,
    trade.currency,
  );
  trade.currentPrice = utils.crypto.getCurrentPrice(trade, referencePrice);
};

// POST /trades/{id}/launch
exports.launch = async function launch(ctx) {
  const user = await ctx.auth();

  const trade = await getDetailTradeFun(ctx.params.id, true);

  ctx.assert(trade, 404, '挂单不存在');
  ctx.assert(trade.status === 'normal', 400, '挂单状态异常无法交易');
  ctx.assert(trade.creatorId !== user.id, 400, '无法与自己创建的挂单交易');

  ctx.assert(user.moneyPassword, 400, '用户没有设置资金密码');

  const finalFiatAmount = ctx.request.body.finalFiatAmount;
  ctx.assert(finalFiatAmount >= 1, 400, '交易量不能小于1');
  if (trade.maxFiatAmount) {
    ctx.assert(
      finalFiatAmount <= trade.maxFiatAmount,
      400,
      '交易量不在规定范围内',
    );
  }
  if (trade.minFiatAmount) {
    ctx.assert(
      finalFiatAmount >= trade.minFiatAmount,
      400,
      '交易量不在规定范围内',
    );
  }

  const referencePrice = await utils.crypto.getReferencePrice(
    trade.category,
    trade.currency,
  );
  const finalPrice = utils.crypto.getCurrentPrice(trade, referencePrice);

  if (trade.maxPrice) {
    ctx.assert(finalPrice <= trade.maxPrice, 400, '交易价格不在规定范围内');
  }
  if (trade.minPrice) {
    ctx.assert(finalPrice >= trade.minPrice, 400, '交易价格不在规定范围内');
  }

  const finalReceivedCryptoAmount = finalFiatAmount / finalPrice;
  const finalCryptoFeeAmount = finalReceivedCryptoAmount * 0.01;
  const finalTotalCryptoAmount =
    finalReceivedCryptoAmount + finalCryptoFeeAmount;

  const history = trade.history;
  history.push({
    action: 'lanuch',
    time: moment().toISOString(),
  });

  const update = {
    status: 'waitConfirmed',
    finalFiatAmount,
    finalPrice,
    finalTotalCryptoAmount,
    finalCryptoFeeAmount,
    finalReceivedCryptoAmount,
    history,
  };

  // 冻结持币方资产
  let cryptoFromUserId;
  if (trade.type === 'buy') {
    // 买单，user为持币方
    cryptoFromUserId = user.id;
    update.cryptoFromUserId = user.id;
  } else {
    // 卖单，creatorId为持币方
    cryptoFromUserId = trade.cryptoFromUserId;
    update.cryptoToUserId = user.id;
  }

  // 冻结用户资产
  ctx.assert(
    await utils.crypto.frozenAsset(
      cryptoFromUserId,
      trade.category,
      finalTotalCryptoAmount,
    ),
    400,
    '卖币方可用数字货币余额不足，资产冻结失败',
  );

  await trade.update(update);

  // 创建超时定时
  utils.schedule.cancelAllTimeout(trade);
  utils.schedule.confirmTimeout(trade);

  // 发送消息
  await utils.notifications.createNotification(
    trade.creatorId,
    'trade',
    '你的交易订单已被人接单，请及时查看',
    {
      tradeId: trade.id,
    },
  );

  // 创建一个新的挂单
  const data = _.pick(trade, [
    'type',
    'category',
    'region',
    'currency',
    'floatingPrice',
    'maxPrice',
    'minPrice',
    'maxFiatAmount',
    'minFiatAmount',
    'payPeriod',
    'isUseAlipayPayment',
    'isUseWechatPayment',
    'isUseBankCardPayment',
    'comment',
    'creatorId',
  ]);
  data.status = 'normal';
  data.isFollowFiatAmount = true;
  data.history = [
    {
      action: 'create',
      time: moment().toISOString(),
    },
  ];

  if (data.type === 'buy') {
    data.cryptoToUserId = data.creatorId;
  } else {
    data.cryptoFromUserId = data.creatorId;
  }
  await models.trade.create(data);

  ctx.body = trade;
};

// POST /trades/{id}/confirm
exports.confirm = async function confirm(ctx) {
  const user = await ctx.auth();

  const trade = await getDetailTradeFun(ctx.params.id, true);

  ctx.assert(trade, 404, '挂单不存在');
  ctx.assert(trade.status === 'waitConfirmed', 400, '挂单状态异常无法修改');
  ctx.assert(trade.creatorId === user.id, 400, '用户非挂单创建者');

  const history = trade.history;
  history.push({
    action: 'confirm',
    time: moment().toISOString(),
  });

  await trade.update({
    status: 'pending',
    history,
  });

  // 创建超时定时
  utils.schedule.cancelAllTimeout(trade);
  utils.schedule.pendingTimeout(trade);

  // 发送消息
  const notificationUserId =
    trade.cryptoFromUserId === trade.creatorId
      ? trade.cryptoToUserId
      : trade.cryptoFromUserId;
  await utils.notifications.createNotification(
    notificationUserId,
    'trade',
    '你的交易请求已被确认，请及时查看',
    {
      tradeId: trade.id,
    },
  );

  ctx.body = trade.toJSON();
};

// POST /trades/{id}/reject
exports.reject = async function reject(ctx) {
  const user = await ctx.auth();

  const trade = await getDetailTradeFun(ctx.params.id, true);

  ctx.assert(trade, 404, '挂单不存在');
  ctx.assert(trade.status === 'waitConfirmed', 400, '挂单状态异常无法修改');
  ctx.assert(trade.creatorId === user.id, 400, '用户非挂单创建者');

  const history = trade.history;
  history.push({
    action: 'reject',
    time: moment().toISOString(),
  });

  const update = {
    status: 'canceled',
    history,
  };

  await trade.update(update);

  utils.schedule.cancelAllTimeout(trade);

  // 解冻用户资产
  await utils.crypto.unfrozenAsset(
    trade.cryptoFromUserId,
    trade.category,
    trade.finalTotalCryptoAmount,
  );

  // 发送消息
  const notificationUserId =
    trade.cryptoFromUserId === trade.creatorId
      ? trade.cryptoToUserId
      : trade.cryptoFromUserId;
  await utils.notifications.createNotification(
    notificationUserId,
    'trade',
    '你的交易请求已被拒绝，请及时查看',
    {
      tradeId: trade.id,
    },
  );

  ctx.body = trade.toJSON();
};

// POST /trades/{id}/confirmSendMoney
exports.confirmSendMoney = async function confirmSendMoney(ctx) {
  const user = await ctx.auth();

  const trade = await getDetailTradeFun(ctx.params.id, true);

  ctx.assert(trade, 404, '挂单不存在');
  ctx.assert(trade.status === 'pending', 400, '挂单状态异常无法交易');
  ctx.assert(trade.cryptoToUserId === user.id, 400, '用户非数字货币接收方');

  const history = trade.history;
  history.push({
    action: 'confirmSendMoney',
    time: moment().toISOString(),
  });

  await trade.update({
    status: 'confirmSendMoney',
    history,
  });

  utils.schedule.cancelAllTimeout(trade);

  // 发送消息
  await utils.notifications.createNotification(
    trade.cryptoFromUserId,
    'trade',
    '订单交易方已经确认打款，请及时查看',
    {
      tradeId: trade.id,
    },
  );

  ctx.body = trade;
};

// POST /trades/{id}/confirmReceiveMoney
exports.confirmReceiveMoney = async function confirmReceiveMoney(ctx) {
  const user = await ctx.auth();

  const trade = await getDetailTradeFun(ctx.params.id, true);

  ctx.assert(user.moneyPassword, 400, '用户没有设置资金密码');
  ctx.assert(
    user.moneyPassword ===
      md5(md5(`${config.passwordKey}_${ctx.request.body.moneyPassword}`)),
    400,
    '用户资金密码输入错误',
  );
  ctx.assert(trade, 404, '挂单不存在');
  ctx.assert(trade.status === 'confirmSendMoney', 400, '挂单状态异常无法交易');
  ctx.assert(trade.cryptoFromUserId === user.id, 400, '用户非数字货币接收方');

  const history = trade.history;
  history.push({
    action: 'confirmReceiveMoney',
    time: moment().toISOString(),
  });

  await trade.update({
    status: 'confirmReceiveMoney',
    history,
  });

  // 资产转移
  await utils.crypto.transferCrypto(
    trade.cryptoFromUserId,
    trade.cryptoToUserId,
    trade.category,
    trade.finalTotalCryptoAmount,
    trade.finalReceivedCryptoAmount,
  );

  await utils.crypto.addUserTradeHistory(
    trade.cryptoFromUserId,
    trade.cryptoToUserId,
    trade.category,
    trade.finalFiatAmount,
  );

  // 发送消息
  await utils.notifications.createNotification(
    trade.cryptoToUserId,
    'trade',
    '订单交易方已经确认收款并打币，请及时查看',
    {
      tradeId: trade.id,
    },
  );

  // create new trade
  if (trade.isFollowFiatAmount && trade.maxFiatAmount > trade.finalFiatAmount) {
    const data = _.pick(trade, [
      'type',
      'category',
      'region',
      'currency',
      'floatingPrice',
      'maxPrice',
      'minPrice',
      'isUseAlipayPayment',
      'isUseWechatPayment',
      'isUseBankCardPayment',
      'comment',
      'isFollowFiatAmount',
      'creatorId',
    ]);
    if (data.type === 'buy') {
      data.cryptoToUserId = data.creatorId;
    } else {
      data.cryptoFromUserId = data.creatorId;
    }
    data.minFiatAmount = 0;
    data.maxFiatAmount = trade.maxFiatAmount - trade.finalFiatAmount;
    data.status = 'normal';
    data.history = [
      {
        action: 'create',
        time: moment().toISOString(),
      },
    ];

    await models.trade.create(data);
  }

  ctx.body = trade;
};

// POST /trades/{id}/cancel
exports.cancel = async function cancel(ctx) {
  const user = await ctx.auth();

  const trade = await getDetailTradeFun(ctx.params.id, true);

  ctx.assert(trade, 404, '挂单不存在');
  ctx.assert(trade.status === 'pending', 400, '挂单状态异常无法取消');
  ctx.assert(
    trade.cryptoToUserId === user.id,
    400,
    '用户非数字货币接收方，无法取消订单',
  );

  const history = trade.history;
  history.push({
    action: 'cancel',
    time: moment().toISOString(),
  });

  await trade.update({
    status: 'canceled',
    history,
  });

  utils.schedule.cancelAllTimeout(trade);

  // 解冻用户资产
  await utils.crypto.unfrozenAsset(
    trade.cryptoFromUserId,
    trade.category,
    trade.finalTotalCryptoAmount,
  );

  ctx.body = trade;
};

// POST /trades/{id}/appeal
exports.appeal = async function appeal(ctx) {
  const user = await ctx.auth();

  const trade = await getDetailTradeFun(ctx.params.id, true);

  ctx.assert(trade, 404, '挂单不存在');
  ctx.assert(
    ['pending', 'confirmSendMoney', 'confirmReceiveMoney'].includes(trade.status),
    400,
    '挂单状态无法申诉',
  );
  ctx.assert(
    trade.cryptoFromUserId === user.id || trade.cryptoToUserId === user.id,
    400,
    '用户非交易参与方，无法进行申诉',
  );

  const history = trade.history;
  history.push({
    action: 'appeal',
    time: moment().toISOString(),
  });

  await trade.update({
    status: 'appeal',
    history,
  });

  utils.schedule.cancelAllTimeout(trade);

  ctx.body = trade;
};

function isRated(history, type) {
  const exist = history.find(elm => elm.data && elm.data.type === type);

  return !!exist;
}

// POST /trades/{id}/rate
exports.rate = async function rate(ctx) {
  const user = await ctx.auth();
  const trade = await getDetailTradeFun(ctx.params.id, true);

  ctx.assert(trade, 404, '挂单不存在');
  ctx.assert(
    trade.status === 'confirmReceiveMoney',
    400,
    '挂单状态异常无法评价',
  );
  ctx.assert(
    trade.cryptoFromUserId === user.id || trade.cryptoToUserId === user.id,
    400,
    '用户非交易参与方，无法进行评价',
  );
  ctx.assert(
    ctx.request.body.rate === 'good' || ctx.request.body.rate === 'bad',
    400,
    '用户填写评价有误',
  );

  const rateField =
    ctx.request.body.rate === 'good'
      ? `${trade.category}TradeGoodRateCount`
      : `${trade.category}TradeBadRateCount`;
  const history = trade.history;

  if (user.id === trade.cryptoFromUserId) {
    ctx.assert(!isRated(history, 'rateToCryptoToUser'), 400, '用户已评价');

    history.push({
      action: 'rate',
      time: moment().toISOString(),
      data: {
        type: 'rateToCryptoToUser',
        rate: ctx.request.body.rate,
        rateFromUserId: trade.cryptoFromUserId,
        rateToUserId: trade.cryptoToUserId,
      },
    });

    await ctx.models.user.increment(
      {
        [rateField]: 1,
      },
      {
        where: {
          id: trade.cryptoToUserId,
        },
      },
    );

    // 发送消息
    await utils.notifications.createNotification(
      trade.cryptoToUserId,
      'trade',
      '订单交易方已对您进行评价，请及时查看',
      {
        tradeId: trade.id,
        fromUserId: trade.cryptoFromUserId,
      },
    );
  } else if (user.id === trade.cryptoToUserId) {
    ctx.assert(!isRated(history, 'rateToCryptoFromUser'), 400, '用户已评价');

    history.push({
      action: 'rate',
      time: moment().toISOString(),
      data: {
        type: 'rateToCryptoFromUser',
        rate: ctx.request.body.rate,
        rateFromUserId: trade.cryptoToUserId,
        rateToUserId: trade.cryptoFromUserId,
      },
    });

    await ctx.models.user.increment(
      {
        [rateField]: 1,
      },
      {
        where: {
          id: trade.cryptoFromUserId,
        },
      },
    );

    // 发送消息
    await utils.notifications.createNotification(
      trade.cryptoFromUserId,
      'trade',
      '订单交易方已对您进行评价，请及时查看',
      {
        tradeId: trade.id,
        fromUserId: trade.cryptoToUserId,
      },
    );
  }

  const update = {
    history,
  };

  if (
    isRated(history, 'rateToCryptoToUser') &&
    isRated(history, 'rateToCryptoFromUser')
  ) {
    update.status = 'closed';
  }

  await trade.update(update);

  utils.schedule.cancelAllTimeout(trade);

  ctx.body = trade;
};

// GET /priceOrder
exports.getPriceOrder = async function getPriceOrder(ctx) {
  const type = ctx.query.type === 'buy' ? 'buy' : 'sell';
  const category = ctx.query.category || 'eth';
  const currency = ctx.query.currency || 'cny';

  const floatingPrice = Number.parseFloat(ctx.query.floatingPrice);

  const option = {
    where: {
      type,
      category,
      currency,
    },
  };
  if (type === 'buy') {
    // 购买单，查找比当前价格更高的价格数量
    option.where.floatingPrice = {
      [Op.gt]: floatingPrice,
    };
  } else {
    // 售卖单，查找比当前价格更低的价格数量
    option.where.floatingPrice = {
      [Op.lt]: floatingPrice,
    };
  }

  const count = await models.trade.count(option);

  ctx.body = count + 1;
};
