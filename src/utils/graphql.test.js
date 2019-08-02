import { clientCacheError, generateErrorRequest, runQuery } from './graphql';
import { client } from './redis';

describe('utils/graphql.js', () => {
  afterAll(() => {
    client.quit();
  });
  describe('when we receive a query', () => {
    test('we have to throw an error in case of a string instead of an object', async () => {
      await expect(runQuery('not-a-query')).rejects.toThrow(Error);
    });
  });
  describe('when we ask to generate an error', () => {
    test('we restrict error information in non-development', async () => {
      const error = generateErrorRequest('test', 'fake-data');
      const errorObj = JSON.parse(error);
      expect(errorObj.error.message).toBe(clientCacheError);
    });
  });
});
