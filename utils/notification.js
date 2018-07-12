const chance = require('chance').Chance();
const moment = require('moment');
const sequelize = require('sequelize');
const db = require('../db');
const request = require('superagent');
const config = require('../config');
const sha256 = require('sha256');

const models = db.models;
const Op = sequelize.Op;

exports.createNotification = async function createNotification(
  userId,
  type,
  content,
  parameters = {},
  isSendSMS = false,
) {
  const notification = await models.notification.create({
    type,
    content,
    status: 'unread',
    parameters,
    userId,
  });

  // TODO: Send Notification SMS

  return notification;
};
