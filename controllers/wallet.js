const db = require('../db');
const chance = require('chance').Chance();
const md5 = require('md5');
const utils = require('../utils');
const config = require('../config');

const models = db.models;

// GET /user/wallets
exports.getUserWallets = async function getUserWallets(ctx) {
  const user = await ctx.auth();

  const where = {
    userId: user.id,
    status: 'normal',
  };

  if (ctx.query.category) {
    where.category = ctx.query.category;
  }

  const wallets = await ctx.models.wallet.findAll({
    where,
  });

  ctx.body = wallets.map(w => w.safe());
};
