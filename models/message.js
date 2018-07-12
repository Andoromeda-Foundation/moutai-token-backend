const DataTypes = require('sequelize');

const sequelize = require('../db/sequelize');

module.exports = sequelize.connect.define(
  'message',
  {
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    indexes: [],
  },
);
