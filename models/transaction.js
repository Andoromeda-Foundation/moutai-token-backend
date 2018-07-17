const DataTypes = require('sequelize');

const sequelize = require('../db/sequelize');

module.exports = sequelize.connect.define('transaction', {
  type: {
    type: DataTypes.ENUM,
    values: ['deposit', 'withdraw', 'income', 'expense'],
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM,
    values: ['pending', 'success', 'fail'],
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  indexes: [],
});
