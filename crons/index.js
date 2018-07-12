const schedule = require('node-schedule');
const config = require('../config');
const db = require('../db');
const md5 = require('md5');
const sequelize = require('sequelize');
const moment = require('moment');

const models = db.models;
const Op = sequelize.Op;

const check = async function check() {
  return true;
};

schedule.scheduleJob('*/5 * * * * *', () => {
  check()
    .then()
    .catch(error => {
      console.error(error); // eslint-disable-line no-console
    });
});
