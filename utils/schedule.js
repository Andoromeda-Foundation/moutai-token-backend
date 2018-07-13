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

exports.initTimeoutJobs = async function initTimeoutJobs() {
  return true;
};
