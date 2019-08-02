import map from 'lodash.map';
import Raven from 'raven';
import RavenLambdaWrapper from 'serverless-sentry-lib';

import { extractMetadataFromItem } from '../utils/cache';
import { getKey, getValue } from '../utils/redis';

export const readCache = RavenLambdaWrapper.handler(Raven, async (event, context) => {
  const redisKeys = await getKey('*');
  const data = [];

  // The cache is indexed by query, stored as strings - A key basically is a query
  const values = await Promise.all(
    map(redisKeys, async (query) => {
      return getValue(query);
    }),
  );

  map(values, (value, index) => {
    data.push({
      ...extractMetadataFromItem(value),
      query: JSON.parse(redisKeys[index]),
    });
  });

  return {
    statusCode: 200,
    body: JSON.stringify(map(data, (d) => {
      const maxLength = 50;
      // Simplify the displayed query to make it more readable, remove \n, convert multiple spaces to single spaces and limit the length
      let queryString = d.query.query.split('\n').join('').split('  ').join(' ').split('  ').join(' ');

      if (queryString.length > maxLength) {
        queryString = queryString.substring(0, maxLength) + ' ... (truncated)';
      }

      return {
        ...d,
        query: {
          ...d.query,
          query: queryString,
        },
      };
    })),
  };
});
