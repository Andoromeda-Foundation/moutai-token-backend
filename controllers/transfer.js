const db = require('../db');
const Web3 = require('web3');
const chance = require('chance').Chance();
const md5 = require('md5');
const utils = require('../utils');
const config = require('../config');

const models = db.models;
const web3 = new Web3(Web3.givenProvider);

function withdrawToTransfer(withdraw) {
  const data = {
    type: 'withdraw',
    category: withdraw.crypto,
    status: 'done',
    from: withdraw.sender_addr,
    to: withdraw.recipient_addr,
    txHash: withdraw.tx_hash,
    totalAmount: withdraw.amount,
    feeAmount: withdraw.fee,
    actualAmount: withdraw.fee
      ? withdraw.amount - withdraw.fee
      : withdraw.amount,
    confirmedAt: null,
    userId: withdraw.sender_id,
    comment: withdraw.comment,
  };

  return data;
}

function depositToTransfer(deposit) {
  const data = {
    type: 'deposit',
    category: deposit.crypto,
    status: 'done',
    from: deposit.sender_addr,
    to: deposit.recipient_addr,
    txHash: deposit.tx_hash,
    totalAmount: deposit.amount,
    feeAmount: 0,
    actualAmount: deposit.amount,
    confirmedAt: deposit.updated_at,
    userId: deposit.recipient_id,
    comment: deposit.comment,
  };

  return data;
}

// GET /user/transfers
exports.getUserTransfers = async function getUserTransfers(ctx) {
  const user = await ctx.auth();

  const type = ctx.query.type === 'deposit' ? 'deposit' : 'withdraw';
  const category = ctx.query.category || 'eth';

  if (type === 'deposit') {
    const deposits = await ctx.models.deposit.findAll({
      where: {
        recipient_id: user.id,
        crypto: category,
      },
      order: [['updated_at', 'DESC']],
    });
    ctx.body = deposits.map(depositToTransfer);
  } else {
    const withdraws = await ctx.models.withdraw.findAll({
      where: {
        sender_id: user.id,
        crypto: category,
      },
      order: [['updated_at', 'DESC']],
    });
    ctx.body = withdraws.map(withdrawToTransfer);
  }
};

// POST /user/transfers
exports.createTransfer = async function createTransfer(ctx) {
  const user = await ctx.auth();

  const category = ctx.request.body.category || 'eth';
  const type = ctx.request.body.type === 'deposit' ? 'deposit' : 'withdraw';

  ctx.assert(user.moneyPassword, 400, '用户没有设置资金密码');
  ctx.assert(
    user.moneyPassword ===
      md5(md5(`${config.passwordKey}_${ctx.request.body.moneyPassword}`)),
    400,
    '用户资金密码输入错误',
  );

  if (category === 'eth') {
    ctx.assert(web3.utils.isAddress(ctx.request.body.to), 400, '钱包地址有误');
    ctx.assert(ctx.request.body.totalAmount >= 1, 400, '小于1eth无法提取');
  }
  // TODO: check other address is valid

  ctx.assert(
    user[`${category}AvailableAssetAmount`] >= ctx.request.body.totalAmount,
    400,
    '用户余额不足',
  );

  const withdraw = await ctx.models.withdraw.create({
    crypto: category,
    recipient_addr: ctx.request.body.to,
    amount: ctx.request.body.totalAmount,
    sender_id: user.id,
    comment: ctx.request.body.comment || null,
  });

  ctx.body = withdrawToTransfer(withdraw);
};
