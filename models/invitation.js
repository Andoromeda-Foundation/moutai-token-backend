const DataTypes = require('sequelize');

const sequelize = require('../db/sequelize');

module.exports = sequelize.connect.define('invitation', {
  code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  indexes: [],
});
