import { createLogger } from '@unly/utils-simple-logger';
import get from 'lodash.get';
import map from 'lodash.map';
import Raven from 'raven';
import RavenLambdaWrapper from 'serverless-sentry-lib';

import { updateItemInCache } from '../utils/cache';
import { runQuery } from '../utils/graphql';
import { getKey } from '../utils/redis';

const logger = createLogger({
  label: 'Refresh cache',
});

const noTokenProvidedMessage = `Authentication failed`;

/**
 * Refresh the cache (redis)
 * Executes all queries that are stored in the redis store in order to refresh all cached values
 * The cache must only be refreshed if there was no error during the query
 * If an error happens during a query, the cache must not be updated, because the goal of this caching mechanism is to ensure stability/robustness, even at the price of data integrity
 *
 * @type {Function}
 */
export const refreshCache = RavenLambdaWrapper.handler(Raven, async (event, context) => {
  const GCMSWebhookToken = get(event.headers, 'GraphCMS-WebhookToken', null);

  // Check first if a correct token was provided - Security to avoid unauthenticated callers to DDoS GCMS API by spawning a refresh loop
  if (GCMSWebhookToken !== process.env.REFRESH_CACHE_TOKEN) {
    const errorMessage = `Attempt to refresh cache with wrong token: "${GCMSWebhookToken}" (access refused)`;
    logger.error(errorMessage);

    return {
      statusCode: 401,
      body: JSON.stringify({
        error: noTokenProvidedMessage,
      }),
    };
  }
  const redisKeys = await getKey('*');
  const queriesPromises = redisKeys.map(async (key) => {
    return runQuery(JSON.parse(key));
  });

  // Fetch all queries in parallel and await them to be all finished
  const queriesResults = await Promise.all(queriesPromises);
  const updatedResults = [];
  const failedResults = [];

  map(queriesResults, (queryResult, index) => {
    if (queryResult.error) {
      // When a query returns an error, we don't update the cache
      Raven.captureException(`Cache refresh failed with "${JSON.stringify(queryResult.error)}"`);
      logger.error(JSON.stringify(queryResult.error, null, 2), 'graphcms-query-error');
      failedResults.push(queryResult);
    } else {
      // Otherwise, update the existing entry with the new values
      // XXX Executed async, no need to wait for result to continue
      updateItemInCache(redisKeys[index], queryResult)
        .catch((error) => {
          Raven.captureException(error);
          logger.error(`Redis key ${index} failed to update (key size: ${JSON.stringify(redisKeys[index]).length})`);
        });

      // XXX If the redis cache update fails, this will be wrong information, but we assume it won't
      //  (as it won't matter since those results aren't used for anything but debug)
      logger.info(`Redis key ${index} was successfully updated (new data size: ${JSON.stringify(queryResult).length})`);
      updatedResults.push(queryResult);
    }
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: true,
      message: `${updatedResults.length} entries updated, ${failedResults.length} entries failed`,
      updatedEntries: updatedResults.length,
      failedEntries: failedResults.length,
    }),
  };
});
