const DataTypes = require('sequelize');

const sequelize = require('../db/sequelize');

module.exports = sequelize.connect.define(
  'user',
  {
    nickname: {
      // 昵称
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    phone: {
      // 手机号码
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        is: /^(13[0-9]|14[579]|15[0-3,5-9]|16[6]|17[0135678]|18[0-9]|19[89])\d{8}$/i,
      },
    },
    password: {
      // 密码
      type: DataTypes.STRING,
      allowNull: false,
    },
    balance: {
      // 账户余额
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    bio: {
      // 个性签名
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    token: {
      // 请求token
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    kyc: {
      // 认证信息
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    timestamps: true,
    indexes: [],
  },
);

module.exports.prototype.safe = sequelize.methods.hide([
  'password',
  'token',
  'kyc',
]);
