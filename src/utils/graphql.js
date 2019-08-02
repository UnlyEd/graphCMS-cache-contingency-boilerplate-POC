import gql from 'graphql-tag';

export const clientCacheError = 'An expected error happened';

export async function runQuery(query, client) {
  if (typeof client === 'undefined' && !client) {
    const { ApolloClientFactory } = require('./apolloClient');
    client = ApolloClientFactory();
  }
  if(typeof query === 'string'){
    throw Error('query should be an object - Did you forgot to JSON.parse() it?');
  }
  query['query'] = gql`${query['query']}`;
  return client.query(query);
}

export function generateErrorRequest(error, data = {}) {
  if (process.env.NODE_ENV === 'development') { // Only display the real error in development environment
    return JSON.stringify({
      data,
      error
    });
  }
  return JSON.stringify({
    data,

    // Hide internal errors from the client
    error: !!error ? {
      message: clientCacheError,
    } : null,
  });
}
