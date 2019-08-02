import { createLogger } from '@unly/utils-simple-logger';
import inquirer from 'inquirer';
import logSymbols from 'log-symbols';

import { querySchemaData, querySchemaData2 } from '../../gql/querySchema';

const { exit, refreshCache, sendQuery } = require('./commandsHandler');

const logger = createLogger({
  label: 'Cache handler',
});

const promptObj = {
  type: 'list',
  name: 'actions',
  message: 'What do you want to do?',
  choices: [
    {
      name: 'Send query 1',
      value: 'send-cache1',
      callback: sendQuery,
      arg: querySchemaData2,
    }, {
      name: 'Send query 2',
      value: 'send-cache2',
      callback: sendQuery,
      arg: querySchemaData,
    }, {
      name: 'Refresh all cache',
      value: 'refresh-cache',
      callback: refreshCache,
      arg: null,
    }, {
      name: 'Quit client',
      value: 'exit',
      callback: exit,
      arg: null,
    },
  ],
};

async function cli() {
  let answer = await inquirer.prompt([promptObj]);
  const commandHandler = promptObj['choices'].filter(el => el['value'] === answer['actions']);

  if (commandHandler.length !== 1 || typeof commandHandler[0]['callback'] === 'undefined') {
    logger.error(logSymbols.error + `Unknown command '${answer['actions']}', please make sure you have set a callback function`);
  } else {
    await commandHandler[0]['callback'](commandHandler[0]['arg']);
  }

  await cli();
}

try {
  cli();
} catch (e) {
  logger.error(logSymbols.error + e);
}
