const path = require('path');
const fs = require('fs');
const debug = require('debug')('app:db:define');
const process = require('process');

const sequelize = require('./sequelize').connect;

const models = {};

const define = function define() {
  // define models from model files
  const files = fs
    .readdirSync(path.join(__dirname, '../models'))
    .filter(file => !file.match(/\..*\.swp/));
  files.forEach(file => {
    models[path.parse(file).name] = require("../models/" + file); // eslint-disable-line
  });

  // set associations of models
  // spirit: userId
  models.user.hasMany(models.spirit);
  models.spirit.belongsTo(models.user);

  // transaction: userId
  models.user.hasMany(models.transaction);
  models.transaction.belongsTo(models.user);

  // trade: fromUserId, toUserId, spiritId
  models.user.hasMany(models.trade, {
    foreignKey: 'fromUserId',
  });
  models.trade.belongsTo(models.user, {
    foreignKey: 'fromUserId',
    as: 'fromUser',
  });
  models.user.hasMany(models.trade, {
    foreignKey: 'toUserId',
  });
  models.trade.belongsTo(models.user, {
    foreignKey: 'toUserId',
    as: 'toUser',
  });
  models.spirit.hasMany(models.trade);
  models.trade.belongsTo(models.spirit);

  // message: spiritId, userId
  models.message.belongsTo(models.user);
  models.spirit.hasMany(models.message);
  models.message.belongsTo(models.spirit);

  // notification: userId
  models.user.hasMany(models.notification);
  models.notification.belongsTo(models.user);

  // delivery: userId, spiritId
  models.user.hasMany(models.delivery);
  models.delivery.belongsTo(models.user);
  models.spirit.hasOne(models.delivery);
  models.delivery.belongsTo(models.spirit);
};

define();

exports.init = async function init(isRebuildAll, rebuildModels) {
  if (process.env.NODE_ENV === 'production' && isRebuildAll) {
    throw new Error('Production Env with all models');
  }

  if (!isRebuildAll && !rebuildModels) {
    throw new Error('No models have been rebuild');
  }

  if (isRebuildAll) {
    await sequelize.drop();
    await sequelize.sync();
    debug('Sequelize sync finish');
  } else if (rebuildModels) {
    for (let i = 0; i < rebuildModels.length; i += 1) {
      const model = models[rebuildModels[i]];
      if (model) {
        await model.drop(); // eslint-disable-line no-await-in-loop
        await model.sync(); // eslint-disable-line no-await-in-loop
        debug(`Model ${rebuildModels[i]} init finish`); // eslint-disable-line no-console
      } else {
        throw new Error(`Model ${rebuildModels[i]} does not exist`);
      }
    }
  }
};

exports.models = models;
exports.sequelize = sequelize;
