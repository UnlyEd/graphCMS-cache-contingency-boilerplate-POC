import { client, flushdb, getValue } from '../utils/redis';
import { cacheQuery } from './cache-query';
import { clientCacheError } from '../utils/graphql';
import { addItemToCache, extractMetadataFromItem, extractQueryResultsFromItem } from '../utils/cache';
import { eventExample, responseSchemaData } from '../utils/queries.test';

describe('functions/cache-query.js', () => {
  afterAll(() => {
    client.quit();
  });

  describe('cacheQuery should return the cached data', () => {
    test('when the query is not cached yet (empty cache)', async () => {
      await flushdb();

      const result = await cacheQuery(eventExample, null);
      expect(result).toBeObject();
      expect(JSON.parse(result.body)).toEqual(responseSchemaData);
    });

    test('when the query is cached manually using "addItemToCache"', async () => {
      // We use another client to connect to localhost instead of graphCMS
      const flushResult = await flushdb();
      expect(flushResult).toEqual('OK'); // Check that redis flushed the DB correctly

      const response = await addItemToCache(JSON.stringify(eventExample), 'test-value');
      expect(response).not.toBeNull();

      const item = await getValue(JSON.stringify(eventExample));
      const queryResults = extractQueryResultsFromItem(item);
      expect(queryResults).toEqual('test-value');

      const metadata = extractMetadataFromItem(item);
      expect(metadata.updatedAt).toBeNull();
      expect(metadata.version).toEqual(0);
    });

    test('when the query is cached automatically using "cacheQuery"', async () => {
      const flushResult = await flushdb();
      expect(flushResult).toEqual('OK'); // Check that redis flushed the DB correctly

      // Use fake timers to wait than redis wrote data
      jest.useFakeTimers();

      // Check the response contains the expected data
      const result = await cacheQuery(eventExample, null);
      expect(result).toBeObject();
      const { statusCode, body } = result;
      const { data, error } = JSON.parse(body);
      expect(statusCode).toBe(200); // Should return good status
      expect(data).toBeObject(); // Should contain data
      expect(error).toBeUndefined(); // Shouldn't contain error

      // Wait for redis to perform its write (doesn't seem to work properly)
      jest.runAllTimers();
      // Check the cache contains the expected data as well (should have been updated by cacheQuery)
      const item = await getValue(eventExample.body);
      const queryResults = extractQueryResultsFromItem(item);
      expect(queryResults).toBeObject();

      const metadata = extractMetadataFromItem(item);
      expect(metadata.updatedAt).toBeNull();
      expect(metadata.version).toEqual(0);
    });
  });

  describe('cacheQuery should return an error', () => {
    describe('when the cache is empty and', () => {
      beforeEach(async () => {
        const flushResult = await flushdb();
        expect(flushResult).toEqual('OK'); // Check that redis flushed the DB correctly
      });

      test('when graphCMS is down', async () => {
        const { body } = await cacheQuery({
          ...eventExample,
          __TEST_GRAPHCMS_ENDPOINT: '',
        }, null);
        const result = JSON.parse(body);
        expect(result).toBeObject();
        expect(result).toMatchObject({
          'data': {},
          'error': { message: clientCacheError },
        });
      });
      test('on using bad token for GraphCMS', async () => {
        const { body } = await cacheQuery({
          ...eventExample,
          __TEST_GRAPHCMS_TOKEN: '',
        }, null);
        const result = JSON.parse(body);
        expect(result).toBeObject();
        expect(result).toMatchObject({
          'data': {},
          'error': { message: clientCacheError },
        });
      });
    });
  });

  describe('cacheQuery should return data', () => {
    describe('when the cache is filled and', () => {
      beforeEach(async () => {
        await flushdb();
        await addItemToCache(eventExample.body, responseSchemaData);
      });

      test('even when GraphCMS is down', async () => {
        const { body } = await cacheQuery({
          ...eventExample,
          __TEST_GRAPHCMS_ENDPOINT: '',
        }, null);
        expect(JSON.parse(body)).toBeObject();
        expect(JSON.parse(body)).toEqual(responseSchemaData);
      });

      test('on using bad token for GraphCMS', async () => {
        const { body } = await cacheQuery({
          ...eventExample,
          __TEST_GRAPHCMS_TOKEN: '',
        }, null);
        expect(JSON.parse(body)).toEqual(responseSchemaData);
      });
    });
  });
});
