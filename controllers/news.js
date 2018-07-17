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

// GET /spirits/{id}/news
exports.getSpiritNewsById = async function getSpiritNewsById(ctx) {
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

  const newsArray = await models.news.findAll({
    where: {
      spiritId: spirit.id,
    },
    order: [
      ['createdAt', 'DESC'],
    ],
  });

  ctx.body = newsArray;
};
