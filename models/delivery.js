const DataTypes = require('sequelize');

const sequelize = require('../db/sequelize');

module.exports = sequelize.connect.define('delivery', {
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  indexes: [],
});
