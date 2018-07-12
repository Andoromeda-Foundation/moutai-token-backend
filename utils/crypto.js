const chance = require('chance').Chance();
const moment = require('moment');
const sequelize = require('sequelize');
const db = require('../db');

const models = db.models;
const Op = sequelize.Op;

exports.getReferencePrice = async function getReferencePrice(
  category,
  currency,
) {
  const keyValue = await models.keyValue.find({
    where: {
      key: `${category}/${currency}`,
    },
  });

  if (keyValue) {
    return keyValue.value.currentPrice;
  }

  return NaN;
};

exports.getCurrentPrice = function getCurrentPrice(trade, referencePrice) {
  let currentPrice = referencePrice * trade.floatingPrice;

  if (trade.minPrice && currentPrice < trade.minPrice) {
    currentPrice = trade.minPrice;
  }
  if (trade.maxPrice && currentPrice > trade.maxPrice) {
    currentPrice = trade.maxPrice;
  }

  return currentPrice;
};

exports.getTradeNumber = async function getReferencePrice(category, currency) {
  // TODO: 生成交易流水号
};

exports.frozenAsset = async function frozenAsset(userId, category, amount) {
  // TODO: 改为使用事务和锁实现
  const user = await models.user.find({
    where: {
      id: userId,
    },
  });
  if (!user || user[`${category}AvailableAssetAmount`] < amount) {
    return false;
  }

  await models.user.increment(
    {
      [`${category}AvailableAssetAmount`]: -amount,
      [`${category}FrozenAssetAmount`]: amount,
    },
    {
      where: {
        id: userId,
      },
    },
  );

  return true;
};

exports.unfrozenAsset = async function unfrozenAsset(userId, category, amount) {
  // TODO: 改为使用事务和锁实现
  await models.user.increment(
    {
      [`${category}AvailableAssetAmount`]: amount,
      [`${category}FrozenAssetAmount`]: -amount,
    },
    {
      where: {
        id: userId,
      },
    },
  );

  return true;
};

exports.transferCrypto = async function transferCrypto(
  fromUserId,
  toUserId,
  category,
  finalTotalCryptoAmount,
  finalReceivedCryptoAmount,
) {
  // TODO: 改为使用事务和锁实现
  await models.user.increment(
    {
      [`${category}FrozenAssetAmount`]: -finalTotalCryptoAmount,
    },
    {
      where: {
        id: fromUserId,
      },
    },
  );

  await models.user.increment(
    {
      [`${category}AvailableAssetAmount`]: finalReceivedCryptoAmount,
    },
    {
      where: {
        id: toUserId,
      },
    },
  );
};

exports.addUserTradeHistory = async function addUserTradeHistory(
  fromUserId,
  toUserId,
  category,
  finalFiatAmount,
) {
  await models.user.increment(
    {
      [`${category}TradeFiatAmount`]: finalFiatAmount,
      [`${category}TradeCount`]: 1,
      totalTradeCount: 1,
    },
    {
      where: {
        id: {
          [Op.in]: [fromUserId, toUserId],
        },
      },
    },
  );
};
