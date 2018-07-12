const DataTypes = require('sequelize');
const moment = require('moment');

const sequelize = require('../db/sequelize');

module.exports = sequelize.connect.define(
  'trade',
  {
    price: {
      // 成交价格
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    indexes: [],
  },
);
