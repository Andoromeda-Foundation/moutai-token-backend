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
    if (config.SMSProvider === 'dingdongCloud') {
      const smsResult = await request
        .post('https://api.dingdongcloud.com/v1/sms/captcha/send')
        .send({
          apikey: config.dingdongCloud.API_KEY,
          mobile: `${phone}`,
          content: `【CoinFair】你的验证码是${phoneVerificationCode}，请在10分钟内输入。请勿告诉其他人。`,
        });
    } else if (config.SMSProvider === 'tencentCloud') {
      const time = moment().unix();
      const sig = sha256(`appkey=${
        config.tencentCloud.APP_KEY
      }&random=${phoneVerificationCode}&time=${time}&mobile=${phone}`);
      const smsResult = await request
        .post('https://yun.tim.qq.com/v5/tlssmssvr/sendsms')
        .query({
          sdkappid: config.tencentCloud.APP_ID,
          random: phoneVerificationCode,
        })
        .send({
          ext: '',
          extend: '',
          msg: `你的验证码是${phoneVerificationCode}`,
          sig,
          tel: {
            mobile: `${phone}`,
            nationcode: '86',
          },
          time,
          type: 0,
        });
    }
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

exports.validatePhoneCode = async function validatePhoneCode(phone, code) {
  const phoneVerification = await models.phoneVerification.find({
    where: {
      phone,
      phoneVerificationCode: code,
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
