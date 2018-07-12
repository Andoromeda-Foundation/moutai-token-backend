const db = require('../db');
const chance = require('chance').Chance();
const md5 = require('md5');
const utils = require('../utils');
const config = require('../config');
const _ = require('lodash');

const models = db.models;

// GET /users/{id}
exports.getUserById = async function getUserById(ctx) {
  const user = await ctx.models.user.find({
    where: {
      id: ctx.params.id,
    },
  });
  ctx.assert(user, 404, '用户不存在');

  ctx.body = user.safe();
  ctx.body = _.pick(ctx.body, config.userPublicAttributes);
};

// GET /user
exports.getCurrentUser = async function getCurrentUser(ctx) {
  const user = await ctx.auth();

  ctx.body = user.safe();
};

// PATCH /user
exports.updateUser = async function updateUser(ctx) {
  const user = await ctx.auth();

  const update = {};
  if (ctx.request.body.newPassword) {
    ctx.assert(
      ctx.request.body.oldPassword &&
        user.password ===
          md5(md5(`${config.passwordKey}_${ctx.request.body.oldPassword}`)),
      400,
      '原始密码错误',
    );
    update.password = md5(md5(`${config.passwordKey}_${ctx.request.body.newPassword}`));
  }

  if (ctx.request.body.newMoneyPassword) {
    const reg = /^\d{6}$/;
    ctx.assert(
      reg.test(ctx.request.body.newMoneyPassword),
      400,
      '资金密码必须为6位数字',
    );

    if (user.oldMoneyPassword) {
      ctx.assert(
        ctx.request.body.oldMoneyPassword &&
          user.oldMoneyPassword ===
            md5(md5(`${config.passwordKey}_${ctx.request.body.oldMoneyPassword}`)),
        400,
        '原始资金密码错误',
      );
    }

    ctx.assert(ctx.request.body.code, 400, '手机验证码错误');
    const isVerifiedPhoneResult = await utils.phone.validatePhoneCode(
      user.phone,
      ctx.request.body.code,
    );
    ctx.assert(isVerifiedPhoneResult, 400, '手机验证码错误');

    update.moneyPassword = md5(md5(`${config.passwordKey}_${ctx.request.body.newMoneyPassword}`));
    update.isSetMoneyPassword = true;
  }

  if (
    ctx.request.body.nickname &&
    ctx.request.body.nickname !== user.nickname
  ) {
    const isExistNickname = await models.user.count({
      where: {
        nickname: ctx.request.body.nickname,
      },
    });
    ctx.assert(!isExistNickname, 400, '昵称已经被占用');
    update.nickname = ctx.request.body.nickname;
  }

  if (ctx.request.body.phone) {
    const reg = /^(13[0-9]|14[579]|15[0-3,5-9]|16[6]|17[0135678]|18[0-9]|19[89])\d{8}$/;
    ctx.assert(reg.test(ctx.request.body.phone), 400, '手机号码输入有误');

    ctx.assert(ctx.request.body.code, 400, '手机验证码错误');
    const isVerifiedPhoneResult = await utils.phone.validatePhoneCode(
      ctx.request.body.phone,
      ctx.request.body.code,
    );
    ctx.assert(isVerifiedPhoneResult, 400, '手机验证码错误');

    update.phone = ctx.request.body.phone;
  }

  if (ctx.request.body.wechatAccount) {
    update.wechatAccount = _.pick(ctx.request.body.wechatAccount, [
      'name',
      'account',
    ]);
    ctx.assert(
      ctx.request.body.password &&
        user.password ===
          md5(md5(`${config.passwordKey}_${ctx.request.body.password}`)),
      400,
      '更新支付信息验证用户密码错误',
    );
  }
  if (ctx.request.body.aliPayAccount) {
    update.aliPayAccount = _.pick(ctx.request.body.aliPayAccount, [
      'name',
      'account',
    ]);
    ctx.assert(
      ctx.request.body.password &&
        user.password ===
          md5(md5(`${config.passwordKey}_${ctx.request.body.password}`)),
      400,
      '更新支付信息验证用户密码错误',
    );
  }
  if (ctx.request.body.bankAccount) {
    update.bankAccount = _.pick(ctx.request.body.bankAccount, [
      'name',
      'account',
      'bank',
    ]);
    ctx.assert(
      ctx.request.body.password &&
        user.password ===
          md5(md5(`${config.passwordKey}_${ctx.request.body.password}`)),
      400,
      '更新支付信息验证用户密码错误',
    );
  }

  if (ctx.request.body.bio) {
    update.bio = ctx.request.body.bio;
  }

  await user.update(update);

  ctx.body = user.safe();
};

// POST /sendValidatePhoneSMS
exports.sendValidatePhoneSMS = async function sendValidatePhoneSMS(ctx) {
  const reg = /^(13[0-9]|14[579]|15[0-3,5-9]|16[6]|17[0135678]|18[0-9]|19[89])\d{8}$/;
  ctx.assert(reg.test(ctx.request.body.phone), 400, '手机号码输入有误');

  if (ctx.request.body.type === 'register') {
    const user = await models.user.find({
      where: {
        phone: ctx.request.body.phone,
      },
    });
    ctx.assert(!user, 400, '用户已存在');
  } else {
    const user = await models.user.find({
      where: {
        phone: ctx.request.body.phone,
      },
    });
    ctx.assert(user, 400, '用户不存在');
  }

  await utils.phone.sendValidatePhoneSMS(ctx.request.body.phone);

  ctx.status = 201;
};

// POST /user/kyc
exports.kyc = async function kyc(ctx) {
  const user = await ctx.auth();

  ctx.assert(user.verifiedStatus === 'unverified', 400, '用户已经验证');

  await user.update({
    kyc: {
      name: ctx.request.body.name,
      idNumber: ctx.request.body.idNumber,
    },
    verifiedStatus: 'normal',
  });

  ctx.body = user.safe();
};
