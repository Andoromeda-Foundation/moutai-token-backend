const db = require('../db');
const md5 = require('md5');
const utils = require('../utils');
const config = require('../config');
const chance = require('chance').Chance();
const btc = require('bitcoinjs-lib');
const assert = require('assert');
const ethHdkey = require('ethereumjs-wallet/hdkey');
const ethUtil = require('ethereumjs-util');

const btc_xpub =
  'xpub6E6NVP4vKmQHVHCNXeX27Sgs9qdNQB89YXPJRVvDgjMtx9yit6Y3KXULaBBXfRMDzE2hAMcEi6CAVXyjSiusHvyY1a1mX2jDPwXGdLzM8bn';
const eth_xpub =
  'xpub6EThTKCBRKiHpGeoCzvzJqfXdLfcZTpgrkhJisKFBcHxDZLXtLfA864mXhrFiFsPo71QKAed2eATMhC4uosr8oucBYXVJh7SQumDvs8EpgX';
const btc_hdnode = btc.HDNode.fromBase58(btc_xpub);
const eth_hdnode = ethHdkey.fromExtendedKey(eth_xpub);

const getAddBtc142 = index => {
  assert(typeof index === 'number' && index >= 0);
  const pub = btc_hdnode.derive(index);
  return btc.address.fromOutputScript(btc.script.scriptHash.output.encode(btc.crypto.hash160(btc.script.witnessPubKeyHash.output.encode(btc.crypto.hash160(pub.getPublicKeyBuffer())))));
};
const getAddBtc173 = index => {
  assert(typeof index === 'number' && index >= 0);
  const pub = btc_hdnode.derive(index);
  return btc.address.fromOutputScript(btc.script.witnessPubKeyHash.output.encode(btc.crypto.hash160(pub.getPublicKeyBuffer())));
};
const getAddEth = index => {
  assert(typeof index === 'number' && index >= 0);
  return ethUtil.toChecksumAddress(eth_hdnode
    .deriveChild(index)
    .getWallet()
    .getAddressString());
};

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
    ctx.request.body.code,
  );
  ctx.assert(isVerifiedPhoneResult, 400, '手机验证码错误');

  const user = await models.user.create({
    nickname: `user_${chance.word()}`,
    phone: ctx.request.body.phone,
    password: md5(md5(`${config.passwordKey}_${ctx.request.body.password}`)),
  });

  await user.update({
    addressBTC142: getAddBtc142(user.id),
    addressBTC173: getAddBtc173(user.id),
    addressETH: getAddEth(user.id),
  });

  await utils.wallet.createNewUserWallet(user);

  // ONLY WHEN TEST
  await user.update({
    ethAvailableAssetAmount: 5,
    btcAvailableAssetAmount: 5,
    cfcAvailableAssetAmount: 5,
  });

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
    ctx.request.body.code,
  );
  ctx.assert(isVerifiedPhoneResult, 400, '手机验证码错误');

  await user.update({
    password: md5(md5(`${config.passwordKey}_${ctx.request.body.password}`)),
  });

  ctx.body = user.safe();
};

// POST /forgetMoneyPassword
exports.forgetMoneyPassword = async function forgetMoneyPassword(ctx) {
  const user = await models.user.find({
    where: {
      phone: ctx.request.body.phone,
    },
  });
  ctx.assert(user, 400, '用户不存在');

  ctx.assert(user.moneyPassword, 400, '用户没有设置资金密码');

  const isVerifiedPhoneResult = await utils.phone.validatePhoneCode(
    ctx.request.body.phone,
    ctx.request.body.code,
  );
  ctx.assert(isVerifiedPhoneResult, 400, '手机验证码错误');

  await user.update({
    moneyPassword: md5(md5(`${config.passwordKey}_${ctx.request.body.moneyPassword}`)),
  });

  ctx.body = user.safe();
};
