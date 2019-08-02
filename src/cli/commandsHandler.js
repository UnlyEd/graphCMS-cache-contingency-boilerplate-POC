import { createLogger } from '@unly/utils-simple-logger';
import logSymbols from 'log-symbols';
import fetch from 'node-fetch';

const logger = createLogger({
  label: 'Basic Auth',
});

const readCacheRoute = '/cache-query';
const refreshCacheRoute = '/refresh-cache';

if (!process.env.CACHE_BASE_URL) {
  logger.info(`${logSymbols.error} No "CACHE_BASE_URL" defined as environment variable, please make sure you've defined "CACHE_BASE_URL" in the .env.${process.env.NODE_ENV} file.`);
  process.exit();
}

export async function exit() {
  logger.info(`${logSymbols.success} Quitting client`);
  process.exit();
}

export async function sendQuery(query) {
  logger.info(`${logSymbols.info} Querying cache ...`);

  try {
    const { ApolloClientFactory } = require('../utils/apolloClient');
    const cacheEndpoint = process.env.CACHE_BASE_URL + readCacheRoute;
    const client = ApolloClientFactory(cacheEndpoint);
    query = { query: query };
    logger.info(`${logSymbols.info} Sending the following query: \n${JSON.stringify(query)}`);
    const queryResult = await client.query(query);

    if (queryResult['data'] === undefined) {
      throw `Error when requesting data from ${cacheEndpoint}`;
    }
    logger.info(`${logSymbols.info} Received the following response: \n${JSON.stringify(queryResult)}`);
    logger.info(`${logSymbols.success} OK - Query was executed successfully`);
  } catch (e) {
    logger.error(`${logSymbols.error} ERROR - ${e}`);
    throw e;
  }
}

export async function refreshCache() {
  const url = process.env.CACHE_BASE_URL + refreshCacheRoute;
  const result = await fetch(url, { method: 'POST', headers: { "GraphCMS-WebhookToken": process.env.REFRESH_CACHE_TOKEN} });

  if (!result) {
    throw `Couldn't fetch ${url}`;
  }

  logger.info(`${logSymbols.success} OK - Cached queries were refreshed`);
  logger.info(`${logSymbols.info} Result:\n${JSON.stringify(result, null, 2)}`);
}
