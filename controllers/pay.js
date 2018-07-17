const db = require('../db');
const chance = require('chance').Chance();
const md5 = require('md5');
const utils = require('../utils');
const config = require('../config');
const sequelize = require('sequelize');
const moment = require('moment');
const _ = require('lodash');
const request = require('superagent');

const Op = sequelize.Op;
const models = db.models;

// POST /user/deposit
exports.deposit = async function deposit(ctx) {
  const user = await ctx.auth();

  const amount = ctx.request.body.amount;

  const transaction = await models.transaction.create({
    type: 'deposit',
    status: 'pending',
    amount,
    description: `微信充值 ${amount}元`,
    userId: user.id,
  });

  const result = await request
    .post('http://h5-api.lianwiki.cn/pay/wechat/h5pay')
    .send({
      openId: ctx.request.body.openId,
      fee: amount,
      tradeNo: `${transaction.id}`,
      desc: `用户#${user.id} 微信充值 ${amount}元，订单编号#${transaction.id}`,
    });

  ctx.body = result.body;
};
