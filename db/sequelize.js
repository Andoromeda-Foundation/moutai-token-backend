const Sequelize = require('sequelize');
const { db } = require('../config');
const clone = require('clone');

exports.connect = new Sequelize(db.database, db.username, db.password, db);

exports.methods = {
  hide(props) {
    return function hideFunction() {
      const data = clone(this.dataValues);
      props.forEach(prop => {
        delete data[prop];
      });
      return data;
    };
  },
};
