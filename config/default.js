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
exports.yunpian = {
  API_KEY: '8a49677c0c2a5101b8bdee5e8ea0cd35',
};
exports.sendSMS = false;
exports.userPublicAttributes = [
  'id',
  'nickname',
  'bio',
];
exports.nextPriceIncreaseFactor = 0.05;
