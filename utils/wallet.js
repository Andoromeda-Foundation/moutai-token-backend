const Web3 = require('web3');
const config = require('../config');
const db = require('../db');
const md5 = require('md5');

const web3 = new Web3(Web3.givenProvider);
const models = db.models;

exports.createEthWallet = function createWallet(userId) {
  const seed = md5(`${config.seedKey}_${userId}`);
  return web3.eth.accounts.create(seed);
};

exports.createNewUserWallet = async function createNewUserWallet(user) {
  // ETH
  const ethWallet = exports.createEthWallet(user.id);
  await models.wallet.create({
    category: 'eth',
    address: ethWallet.address,
    privateKey: ethWallet.privateKey,
    userId: user.id,
  });

  // TODO: BTC

  // TODO: CFC
};
