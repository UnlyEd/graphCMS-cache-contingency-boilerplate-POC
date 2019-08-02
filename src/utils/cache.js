import { getValue, setValue } from './redis';

/**
 * Add an item to the cache
 * An item is composed of metadata and query results
 * Automatically add metadata
 *
 * @param query
 * @param queryResults
 * @return {Promise<void>}
 */
export const addItemToCache = async (query, queryResults) => {
  return await setValue(query, JSON.stringify({
    createdAt: Date.now(),
    updatedAt: null,
    version: 0,
    queryResults: queryResults,
  }));
};

/**
 * Returns a usable version of an item information
 * Basically parses it if it's a string (the way it's stored in redis)
 * Or do nothing if it's already parsed
 *
 * @param item
 * @return {any}
 */
export const extractCachedItem = (item) => {
  if (typeof item === 'string') {
    return JSON.parse(item);
  } else {
    return item;
  }
};

/**
 * Returns the query results object
 *
 * @param item
 * @return {any.queryResults}
 */
export const extractQueryResultsFromItem = (item) => {
  if(item === null){
    return null;
  }
  if(typeof item === 'undefined'){
    throw Error('"undefined" item was provided, this is likely due to providing a bad key to redis.getValue()');
  }
  const { queryResults } = extractCachedItem(item);

  return queryResults;
};

export const extractMetadataFromItem = (item) => {
  if (item === null) {
    return null;
  }
  const { createdAt, updatedAt, version } = extractCachedItem(item);

  return {
    createdAt,
    updatedAt,
    version,
  };
};

export const updateItemInCache = async (query, queryResults) => {
  const oldValue = await getValue(query);
  const metadata = extractMetadataFromItem(oldValue);
  metadata.version += 1;
  metadata.updatedAt = Date.now(); // Override

  return await setValue(query, JSON.stringify({
    ...metadata,
    queryResults: queryResults,
  }));
};
