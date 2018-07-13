const db = require('../db');
const md5 = require('md5');
const utils = require('../utils');
const config = require('../config');
const chance = require('chance').Chance();

const models = db.models;

// POST /register
exports.register = async function register(ctx) {
  const reg = /^(13[0-9]|14[579]|15[0-3,5-9]|16[6]|17[0135678]|18[0-9]|19[89])\d{8}$/;
  ctx.assert(reg.test(ctx.request.body.phone), 400, '手机号码输入有误');

  const existUser = await models.user.find({
    where: {
      phone: ctx.request.body.phone,
    },
  });
  ctx.assert(!existUser, 400, '手机号码已经被注册');

  const isVerifiedPhoneResult = await utils.phone.validatePhoneCode(
    ctx.request.body.phone,
    ctx.request.body.phoneVerificationCode,
  );
  ctx.assert(isVerifiedPhoneResult, 400, '手机验证码错误');

  const isVerifiedInvitationCode = await utils.invitation.validateInvitationCode(ctx.request.body.invitationCode);
  ctx.assert(isVerifiedInvitationCode, 400, '邀请码错误');

  const user = await models.user.create({
    nickname: ctx.request.body.nickname,
    phone: ctx.request.body.phone,
    password: md5(md5(`${config.passwordKey}_${ctx.request.body.password}`)),
  });

  // ONLY WHEN DEV
  if (config.dev) {
    await user.update({
      balance: 10000,
    });
    await models.transaction.create({
      type: 'income',
      amount: 10000,
      description: '注册赠送10000元',
      userId: user.id,
    });
  }

  const token = md5(`${config.tokenKey}_${user.id}_${new Date()}`);
  await user.update({
    token,
  });

  ctx.body = user.safe();
  ctx.body.token = token;
  ctx.set('token', token);
};

// POST /login
exports.login = async function login(ctx) {
  const user = await models.user.find({
    where: {
      phone: ctx.request.body.phone,
      password: md5(md5(`${config.passwordKey}_${ctx.request.body.password}`)),
    },
  });

  ctx.assert(user, 401, '用户名密码错误');

  const token = md5(`${config.tokenKey}_${user.id}_${new Date()}`);
  await user.update({
    token,
  });

  ctx.body = user.safe();
  ctx.body.token = token;
  ctx.set('token', token);
};

// POST /logout
exports.logout = async function logout(ctx) {
  const user = await ctx.auth();

  await user.update({
    token: null,
  });

  ctx.status = 204;
};

// POST /forgetPassword
exports.forgetPassword = async function forgetPassword(ctx) {
  const user = await models.user.find({
    where: {
      phone: ctx.request.body.phone,
    },
  });
  ctx.assert(user, 400, '用户不存在');

  const isVerifiedPhoneResult = await utils.phone.validatePhoneCode(
    ctx.request.body.phone,
    ctx.request.body.phoneVerificationCode,
  );
  ctx.assert(isVerifiedPhoneResult, 400, '手机验证码错误');

  await user.update({
    password: md5(md5(`${config.passwordKey}_${ctx.request.body.password}`)),
  });

  ctx.body = user.safe();
};
