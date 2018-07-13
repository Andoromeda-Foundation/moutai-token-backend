const db = require('../db');
const process = require('process');
const commander = require('commander');
const yaml = require('js-yaml');
const fs = require('fs-extra');
const path = require('path');

commander
  .option('-A, --all', '重置全部models')
  .option('-m, --models <model>', '指定重建的model')
  .parse(process.argv);

async function createSampleData(modelName) {
  const dataList = yaml.safeLoad(fs.readFileSync(path.join(__dirname, `./sampleData/${modelName}.yaml`), 'utf8')); // eslint-disable-line

  for (const data of dataList) { // eslint-disable-line
    await db.models[modelName].create(data); // eslint-disable-line no-await-in-loop
  }
}

async function init(params) {
  await db.init(
    !!commander.all,
    commander.models ? commander.models.split(',') : null,
  );
  console.log('Database init finish.'); // eslint-disable-line no-console

  await createSampleData('keyValue');
  await createSampleData('user');
  await createSampleData('spirit');
  console.log('Sample Data finish.'); // eslint-disable-line no-console

  process.exit(0);
}

init()
  .then()
  .catch(error => {
    console.error(error.stack); // eslint-disable-line no-console
  });
