import fetch from 'node-fetch';
import { createHttpLink } from 'apollo-link-http';
import { InMemoryCache } from 'apollo-cache-inmemory';
import ApolloClient from 'apollo-client';
import Raven from 'raven';

const graphCMSError = `Unable to connect to GraphCMS due to misconfiguration. Endpoint: "${process.env.GRAPHCMS_ENDPOINT}", Token: "${!!process.env.GRAPHCMS_TOKEN}"`;

if (!process.env.GRAPHCMS_ENDPOINT || !process.env.GRAPHCMS_TOKEN) {
  Raven.captureMessage(graphCMSError, {
    level: 'error'
  });
  throw Error(graphCMSError);
}

export const ApolloClientFactory = (uri = process.env.GRAPHCMS_ENDPOINT, token = process.env.GRAPHCMS_TOKEN) => {
  const apolloClientInstance = new ApolloClient({
    link: createHttpLink({
      uri,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      fetch: fetch,
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
      },
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
    },
  });

  return apolloClientInstance;
};

export default ApolloClientFactory;
