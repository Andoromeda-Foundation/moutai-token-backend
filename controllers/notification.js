const db = require('../db');
const chance = require('chance').Chance();
const md5 = require('md5');
const utils = require('../utils');
const config = require('../config');

const models = db.models;

// GET /user/notification
exports.getUserNotification = async function getUserNotification(ctx) {
  let limit = parseInt(ctx.query.limit || 50, 10);
  limit = limit > 50 ? 50 : limit;
  const offset = parseInt(ctx.query.offset || 0, 10);

  const user = await ctx.auth();

  const where = {
    userId: user.id,
  };
  if (ctx.query.status) {
    where.status = ctx.query.status;
  }

  const notifications = await models.notification.findAll({
    where,
    order: [['createdAt', 'DESC']],
  });

  const count = await models.notification.count({
    where,
  });
  ctx.state.noPack = true;
  ctx.body = {
    limit,
    offset,
    statusCode: 200,
    result: notifications,
    count,
  };
};

// POST /notifications/{id}/read
exports.readNotification = async function readNotification(ctx) {
  const user = await ctx.auth();

  const notification = await ctx.models.notification.find({
    where: {
      id: ctx.params.id,
    },
  });
  ctx.assert(notification, 404, '消息不存在');
  ctx.assert(notification.status === 'unread', 404, '消息已读');

  ctx.body = await notification.update({
    status: 'done',
  });
};
