const db = require('../db');
const process = require('process');
const commander = require('commander');

commander
  .option('-A, --all', '重置全部models')
  .option('-m, --models <model>', '指定重建的model')
  .parse(process.argv);

async function createInitData(modelName) {
  const dataList = require(`./initData/${modelName}.json`); // eslint-disable-line

  for (const data of dataList) { // eslint-disable-line
    await db.models[modelName].create(data); // eslint-disable-line no-await-in-loop
  }
}

async function init(params) {
  await db.init(
    !!commander.all,
    commander.models ? commander.models.split(',') : null,
  );

  await createInitData('keyValue');

  console.log('Database init finish.'); // eslint-disable-line no-console

  process.exit(0);
}

init()
  .then()
  .catch(error => {
    console.error(error.stack); // eslint-disable-line no-console
  });
