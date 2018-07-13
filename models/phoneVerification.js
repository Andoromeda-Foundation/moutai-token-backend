const DataTypes = require('sequelize');

const sequelize = require('../db/sequelize');

module.exports = sequelize.connect.define('phoneVerification', {
  phone: {
    // 手机号码
    type: DataTypes.STRING,
    allowNull: true,
    primaryKey: true,
  },
  phoneVerificationCode: {
    // 验证码
    type: DataTypes.STRING,
    allowNull: true,
  },
  phoneVerificationExpirationTime: {
    // 过期时间
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  indexes: [],
});
