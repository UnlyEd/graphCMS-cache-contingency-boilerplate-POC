import { createLogger } from '@unly/utils-simple-logger';
import Raven from 'raven';
import RavenLambdaWrapper from 'serverless-sentry-lib';

import { addItemToCache, extractQueryResultsFromItem } from '../utils/cache';
import { generateErrorRequest, runQuery } from '../utils/graphql';
import { getValue } from '../utils/redis';

const logger = createLogger({
  label: 'Cache handler',
});

export const cacheError = '[Cache] An unexpected error happened when running the query (no result)';
export const invalidValue = '[Cache] An unexpected value was received';

/**
 * This cache endpoint is meant to never fail and always return the data from the cache, for a given query.
 *
 * Algorithm:
 *  - Fetch an existing value for the given query, from the cache
 *    - If an existing value exists, then returns it
 *    - If not, then execute the query on GraphCMS endpoint
 *      - Once the query results are received, store them in the cache, using the query (string) as key
 *      - Do not wait for cache to be updated before returning the query results
 *      - If the query results cannot be saved to the cache, then generate an alert through Sentry + log
 *
 * @type {Function}
 */
export const cacheQuery = RavenLambdaWrapper.handler(Raven, async (event, context) => {
  let error = null;
  let query = null;
  let queryString = null;
  try {
    queryString = event['body'];
    query = JSON.parse(queryString);
  } catch (e) {
    error = { message: invalidValue };
  }
  const cachedInfo = await getValue(queryString);
  let cachedQueryResults;

  if (!cachedInfo) {
    // If the query isn't cached yet, execute it
    let queryResults;

    try {
      if (process.env.NODE_ENV === 'test') {
        // Changing variables in case of testing GraphCMS endpoint
        const { ApolloClientFactory } = require('../utils/apolloClient');
        queryResults = await runQuery(query, ApolloClientFactory(event.__TEST_GRAPHCMS_ENDPOINT, event.__TEST_GRAPHCMS_TOKEN));
      } else {
        queryResults = await runQuery(query);
      }

      if (!queryResults || queryResults['errors']) {
        throw cacheError;
      }
    } catch (e) {
      Raven.setContext({ queryAsked: query });
      Raven.captureException(e); // TODO add context data (query)
      if (!error) {
        error = { message: String(e) };
      }
    }

    if (!error) {
      // If the query was executed successfully, update the cache
      // XXX Asynchronous on purpose - Do not wait for the cache to be updated before returning the query results (perf++)
      addItemToCache(queryString, queryResults)
        .then((success) => {
          if (!success) {
            const message = `Redis couldn't save the newer query results to the cache, "success": "${success}"`;
            Raven.captureException(message);
            logger.error(message);
          }
        })
        .catch((error) => {
          const message = `Redis couldn't save the newer query results to the cache, an error happened: "${error}"`;
          Raven.captureException(error);
          logger.error(message);
        });
    }

    // XXX Will return the value ASAP (don't wait for the cache to be updated)
    // XXX If the query failed, will return
    return {
      statusCode: 200,
      body: error ? generateErrorRequest(error, JSON.stringify(queryResults)) : JSON.stringify(queryResults),
    };
  } else {
    cachedQueryResults = extractQueryResultsFromItem(cachedInfo);
  }

  return {
    statusCode: 200,
    body: error ? generateErrorRequest(error, JSON.stringify(cachedQueryResults)) : JSON.stringify(cachedQueryResults),
  };
});
