const chance = require('chance').Chance();
const moment = require('moment');
const sequelize = require('sequelize');
const db = require('../db');
const request = require('superagent');
const config = require('../config');
const sha256 = require('sha256');

const models = db.models;
const Op = sequelize.Op;

exports.sendValidatePhoneSMS = async function sendValidatePhoneSMS(phone) {
  let phoneVerificationCode = `${chance.integer({
    min: 1000,
    max: 9999,
  })}`;

  if (config.sendSMS) {
    // PROD MODE
    const smsResult = await request.post('https://sms.yunpian.com/v2/sms/single_send.json')
      .set('Content-Type', 'application/json')
      .send({
        apikey: config.yunpian.API_KEY,
        mobile: `${phone}`,
        text: `【酿造家】您的验证码是${phoneVerificationCode}`,
      });
  } else {
    // DEV MODE
    phoneVerificationCode = '1234';
  }

  await models.phoneVerification.destroy({
    where: {
      phone,
    },
  });

  await models.phoneVerification.create({
    phone,
    phoneVerificationCode,
    phoneVerificationExpirationTime: moment()
      .add(10, 'minutes')
      .toDate(),
  });

  return phoneVerificationCode;
};

exports.validatePhoneCode = async function validatePhoneCode(phone, phoneVerificationCode) {
  const phoneVerification = await models.phoneVerification.find({
    where: {
      phone,
      phoneVerificationCode,
      phoneVerificationExpirationTime: {
        [Op.gte]: new Date(),
      },
    },
  });

  if (!phoneVerification) {
    return false;
  }

  await models.phoneVerification.destroy({
    where: {
      phone,
    },
  });

  return true;
};
