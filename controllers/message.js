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

// GET /spirits/{id}/message
exports.getSpiritMessageById = async function getSpiritMessageById(ctx) {
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

  const messages = await models.message.findAll({
    where: {
      spiritId: spirit.id,
    },
    order: [
      ['createdAt', 'ASC'],
    ],
    include: [{
      model: models.user,
      attributes: config.userPublicAttributes,
    }],
  });

  ctx.body = messages;
};

// POST /spirits/{id}/messages
exports.comment = async function comment(ctx) {
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

  const message = await models.message.create({
    userId: user.id,
    spiritId: spirit.id,
    content: ctx.request.body.content,
  });

  ctx.body = await models.message.find({
    where: {
      id: message.id,
    },
    include: [{
      model: models.user,
      attributes: config.userPublicAttributes,
    }],
  });
};
