const schedule = require('node-schedule');
const chance = require('chance').Chance();
const moment = require('moment');
const sequelize = require('sequelize');
const db = require('../db');
const request = require('superagent');
const config = require('../config');
const sha256 = require('sha256');
const debug = require('debug')('utils:schedule');

const models = db.models;
const Op = sequelize.Op;

const jobs = {};

function findLastActionTime(trade, action) {
  let time = null;
  for (const h of trade.history) { // eslint-disable-line
    if (h.action === action) {
      time = h.time;
    }
  }

  return time;
}

async function confirmTimeoutProcess(tradeId) {
  const trade = await models.trade.find({
    where: {
      id: tradeId,
      status: 'waitConfirmed',
    },
  });
  if (trade) {
    trade.status = 'canceled';
    trade.history.push({
      action: 'waitConfirmedTimeout',
      time: moment().toISOString(),
    });
    trade.history.push({
      action: 'cancel',
      time: moment().toISOString(),
    });
    await trade.save();
  }
}

async function pendingTimeoutProcess(tradeId) {
  const trade = await models.trade.find({
    where: {
      id: tradeId,
      status: 'pending',
    },
  });
  if (trade) {
    trade.status = 'canceled';
    trade.history.push({
      action: 'pendingTimeout',
      time: moment().toISOString(),
    });
    trade.history.push({
      action: 'cancel',
      time: moment().toISOString(),
    });
    await trade.save();
  }
}

exports.initTimeoutJobs = async function initTimeoutJobs() {
  const waitConfirmedTrades = await models.trade.findAll({
    where: {
      status: 'waitConfirmed',
    },
  });

  for (const trade of waitConfirmedTrades) { // eslint-disable-line
    const time = findLastActionTime(trade, 'lanuch');

    if (
      time &&
      moment(time)
        .add(config.confirmTimeoutMinutes, 'minutes')
        .isAfter(moment())
    ) {
      await confirmTimeoutProcess(trade.id); // eslint-disable-line
    } else {
      exports.confirmTimeout(trade);
    }
  }

  const pendingTrades = await models.trade.findAll({
    where: {
      status: 'pending',
    },
  });

  for (const trade of pendingTrades) { // eslint-disable-line
    const time = findLastActionTime(trade, 'confirm');

    if (
      trade.payPeriod &&
      time &&
      moment(time)
        .add(trade.payPeriod, 'minutes')
        .isAfter(moment())
    ) {
      await pendingTimeoutProcess(trade.id); // eslint-disable-line
    } else {
      exports.pendingTimeout(trade);
    }
  }
};

exports.confirmTimeout = function confirmTimeout(trade) {
  const timeoutDate = moment()
    .add(config.confirmTimeoutMinutes, 'minutes')
    .toDate();
  if (!jobs[trade.id]) {
    jobs[trade.id] = [];
  }

  const j = schedule.scheduleJob(timeoutDate, () => {
    confirmTimeoutProcess(trade.id)
      .then(() => {
        debug(`${moment().format('YYYY-MM-DD hh:mm:ss')} [Schedule] Trade [#${
          trade.id
        }] confirm timeout`);
      })
      .catch(error => {
        console.error(error.stack); // eslint-disable-line no-console
      });
  });
  jobs[trade.id].push(j);
};

exports.pendingTimeout = function pendingTimeout(trade) {
  if (trade.payPeriod) {
    const timeoutDate = moment()
      .add(trade.payPeriod, 'minutes')
      .toDate();
    if (!jobs[trade.id]) {
      jobs[trade.id] = [];
    }

    const j = schedule.scheduleJob(timeoutDate, () => {
      pendingTimeoutProcess(trade.id)
        .then(() => {
          debug(`${moment().format('YYYY-MM-DD hh:mm:ss')} [Schedule] Trade [#${
            trade.id
          }] pending timeout`);
        })
        .catch(error => {
          console.error(error.stack); // eslint-disable-line no-console
        });
    });
    jobs[trade.id].push(j);
  }
};

exports.cancelAllTimeout = function cancelAllTimeout(trade) {
  if (jobs[trade.id]) {
    jobs[trade.id].forEach(j => j.cancel());
  }
  jobs[trade.id] = [];
};
