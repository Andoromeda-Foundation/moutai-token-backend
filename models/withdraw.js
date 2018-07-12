const DataTypes = require('sequelize');

const sequelize = require('../db/sequelize');

module.exports = sequelize.connect.define(
  'withdraw',
  {
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    indexes: [],
  },
);
