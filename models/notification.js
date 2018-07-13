const DataTypes = require('sequelize');

const sequelize = require('../db/sequelize');

module.exports = sequelize.connect.define('notification', {
  type: { // 类型
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: { // 状态
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'unread',
  },
  content: { // 内容
    type: DataTypes.STRING,
    allowNull: false,
  },
  parameters: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  timestamps: true,
  indexes: [],
});
