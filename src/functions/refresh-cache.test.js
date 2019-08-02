import { client, flushdb, getKey, getValue } from '../utils/redis';
import { refreshCache } from './refresh-cache';
import { addItemToCache } from '../utils/cache';
import { eventExample} from '../utils/queries.test';

const fakeEvent = {headers : {"GraphCMS-WebhookToken": process.env.REFRESH_CACHE_TOKEN}};

describe('functions/refresh-cache.js', () => {
  beforeEach(async () => {
    const flushResult = await flushdb();
    expect(flushResult).toEqual('OK'); // Check that redis flushed the DB correctly
  });
  afterAll(() => {
    client.quit();
  });

  describe('when using cache', () => {
    test('without token should return Unauthorized', async () => {
      const { statusCode } = await refreshCache({headers : {}});
      expect(statusCode).toBe(401);
    });
    test('with wrong token should return Unauthorized', async () => {
      const { statusCode } = await refreshCache({headers : {Authorization: 'i-am-wrong'}});
      expect(statusCode).toBe(401);
    });
    test('with good token should return Authorized', async () => {
      const { statusCode } = await refreshCache(fakeEvent);
      expect(statusCode).toBe(200);
    });
  });

  describe('when the cache is filled', () => {
    test('refresh should work', async () => {
      const setResult = await addItemToCache(eventExample.body, 'test-value');
      expect(setResult).toEqual('OK'); // Check that redis set data correctly
      await refreshCache(fakeEvent);
      const getResult = await getValue(JSON.stringify(eventExample.body));
      expect(getResult).not.toEqual('test-value');
    });
  });

  describe('when the cache is empty', () => {
    test('refresh should do nothing', async () => {
      await refreshCache(fakeEvent);
      const getResult = await getKey('*');
      expect(getResult.length).toEqual(0);
    });
  });
});
