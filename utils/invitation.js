const chance = require('chance').Chance();
const moment = require('moment');
const sequelize = require('sequelize');
const db = require('../db');
const request = require('superagent');
const config = require('../config');
const sha256 = require('sha256');

const models = db.models;
const Op = sequelize.Op;

exports.validateInvitationCode = async function validateInvitationCode(invitationCode) {
  // ONLY WHEN DEV
  if (invitationCode && config.dev) {
    return true;
  }

  const invitation = await models.invitation.find({
    where: {
      code: invitationCode,
    },
  });

  if (!invitation) {
    return false;
  }

  await models.invitation.destroy({
    where: {
      code: invitationCode,
    },
  });

  return true;
};
