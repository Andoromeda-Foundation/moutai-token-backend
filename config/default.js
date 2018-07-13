exports.db = {
  database: 'moutai-token',
  username: 'postgres',
  password: 'z',
  host: 'localhost',
  dialect: 'postgres',
  pool: {
    max: 5,
    min: 0,
    idle: 10000,
  },
  logging: false,
};
exports.dev = true;
exports.env = 'dev';
exports.host = 'http://127.0.0.1';
exports.webPort = 8080;
exports.tokenKey = 'testTokenKey';
exports.seedKey = 'testSeedKey';
exports.passwordKey = 'testPasswordKey';
exports.categoryList = ['eth', 'btc', 'cfc'];
exports.currencyList = ['cny', 'usd'];
exports.regionList = ['cn'];
exports.tencentCloud = {
  APP_ID: '1400091535',
  APP_KEY: '545a570bcf69595254275fdbfdc6b3a2',
};
exports.dingdongCloud = {
  API_KEY: '1252756c9e48b775f16b7bf3afcede61',
};
exports.sendSMS = false;
exports.SMSProvider = 'dingdongCloud';
exports.userPublicAttributes = [
  'id',
  'nickname',
  'bio',
];
exports.nextPriceIncreaseFactor = 0.05;
