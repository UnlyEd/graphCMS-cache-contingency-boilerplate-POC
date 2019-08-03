[![Maintainability](https://api.codeclimate.com/v1/badges/0f11fc87cdd4240d17e6/maintainability)](https://codeclimate.com/github/UnlyEd/graphCMS-cache-contingency-boilerplate/maintainability)

# GraphCMS Cache Contingency

> The main goal of this service is to provide a **reliable cache contingency backup plan** in case a GraphCMS endpoint is failing.
This service most important priority is the **service reliability**, not the **data consistency**, which may not always be up-to-date.

## Benefits

But it also has other benefits:

1. **Contingency backup plan for a GraphCMS endpoint**: If a GCMS endpoint is failing (whether it's a bug, planned maintenance, etc.), then all our customer would be affected at once.
    As we cannot let this happen for obvious reasons, the goal of this contingency cache is to take over if GCMS is failing.
1. **Auth proxy**: Also, this service acts as a proxy, and can be used to hide authentication credentials from the client (front-end apps).
    This way, credentials such as GCMS API token are only used here, from this service, on the server side, and are therefore safe.
1. **Cost mitigation**: As we won't hit the GCMS API directly, but most requests are gonna be cached, the usage cost is decreased.
1. **Performances**: As we don't run a whole query every time but just return the cached results, this has benefits on performances.
1. **Additional data processing**: As this service acts as a proxy, it could also perform additional data processing, such as aggregations, that aren't available natively with GraphCMS.
    This is a possibility, but not the main purpose. And it's out of the scope for now, but could come in handy later.

## Getting started

Watch this 10mn video to understand and see it in action!

[![GraphCMS Cache COntingency in action](https://img.youtube.com/vi/k4Bd-XHmiBM/0.jpg)](https://youtu.be/k4Bd-XHmiBM)

Clone the repo, then configure your local install:

- `nvm use` or `nvm install`
- `yarn install`
- Look for `TODO` in project file and update values (also remove inline comments in .yml files, they're not supported and comments will be used as value as well)
- Pro tip: Look at [this PR](https://github.com/UnlyEd/graphCMS-cache-contingency-boilerplate/pull/1) to see what I've done to make it work locally, it'll give you a head start! ;)
- `yarn start` # Start localhost:8085
- Go to `/status` and `/read-cache`
- `yarn emulate:client` play around with fake queries sent to :8085 and see how /read-cache data changes

On AWS (staging):
- `yarn deploy` (you may want to either disable or configure the `serverless-domain-manager` plugin)
- `yarn emulate:client:staging` to send queries to your staging endpoint and test behavior manually there

On AWS (prod):
- `yarn deploy:production`

### Configure your app that queries GCMS API to use your online cache

It really depends on the implementation here.
If you're using react with Apollo for instance, it's just a matter of changing the endpoint to target your cache (`/cache-query`) rather than your GCMS endpoint, and not use any credentials (the cache doesn't need any).

It should be simple and straightforward, as it's just a matter of fetching your cache `/cache-query` endpoint instead of hitting your GraphCMS endpoint directly.

Also, you'll need to configure a webhook on GraphCMS to hit the `/refresh-cache` endpoint, and provide proper token in `GraphCMS-WebhookToken` header.

> Testing with a non-production application is strongly recommended to begin with. Also, use a `QUERY` GraphCMS token, you don't need to use a token that can write, read is enough and therefore more secure.


---

## Cache workflow, and cache invalidation

### Cache behaviour

> The cache uses queries as index, and GCMS API responses as values.

It uses Redis as caching engine. 
A redis key can hold up to 512MB of data _(it's therefore not a limitation, we won't ever reach that)_

#### Cache strategy

> "Always reliable, eventually synchronized"
>
The cache will **always return the value from the cache**. _It will never check if a newer value exists on the GCMS's side._
Therefore, it may not be in-sync with the actual values held by GCMS, even though this isn't supposed to happen, it may happen, by design.

Due to this behaviour, the cache would never send fresher data on its own. 
That's why there is a "**cache invalidation**" workflow which goal's to refresh the data in the cache.

### Cache invalidation behaviour

On GCMS's side, a **WebHook** is meant to **trigger** a **cache invalidation** every time a change is made in the data held by GCMS.

> WebHooks can be configured from there: https://app.graphcms.com/0ae6e1f85bfe428d8f39c285ba83ec56/staging/webhooks
> Each stage has its own WebHooks.

The WebHook should be configured to hit the **cache invalidation endpoint**, which will run a query for all existing keys in the cache.
The cache uses a Redis storage, with the **query** (as string) used as **key**, and the **query results** (as json) used as **value**.

So, every time any data is changed in GCMS, the whole cache is refreshed.

> This design fits our usage, as we have very few writes but lots of reads.
> If our usage would change in the future, then the cache's behaviour should be changed accordingly.

### Cache version history

Using a protected endpoint /read-cache, you can visualise all **queries** (redis indexes) that are stored in the cache.

For each query, there is a `version` and `updatedAt` fields that helps you understand when was the cached value refreshed for the last time (and how many times since it was initially added).

Structure example:
```json
{
    "createdAt": 1564566367896,
    "updatedAt": 1564566603538,
    "version": 2,
    "query": {
        "operationName": null,
        "variables": {},
        "query": "{ organisations { name __typename }}"
    }
}

```

> Good to know: 
> - The first `query` (top-level) is the object representation of the `gql` version of the query.
> It contains a `query`, which is the string representation of the query. _(basically, what's sent over the network)_
> - The `query.query` is sanitized and doesn't fully represent the key stored on redis (trim of `\n`, truncated (50 chars), etc.), for the sake of readability.
> - There is **no way to see the data** (as it could be sensitive), only the keys.

---

## API endpoints and usages

### Cache endpoint

> POST `/cache-query`

- Expects a GraphQL query as `body`. _(the same way it's natively handled by GCMS API)_
- Forwards the query to GCMS API (if not cached already). _(will be executed by GCMS API)_
- Returns the query results (from GCMS API or from the redis cache).

### Cache invalidation endpoint

> POST `/refresh-cache`

- Doesn't expect any particular parameter.
- Refresh all cached data by running all cached queries against GCMS API.
- Should be configured through your GraphCMS WebHook, so that any data modification trigger the WebHook, which will in turn refresh all cached data.

> Protected by an authorization Header `GraphCMS-WebhookToken` that must contain the same token as the one defined in your REFRESH_CACHE_TOKEN environment variable

### Read cached keys/GQL queries from cache

> GET `/read-cache`

- Doesn't expect any particular parameter
- Display all cached queries

> Protected by Basic Auth, see `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` env variables.

### Status

> GET `/status`

- Used by AWS Health Checks to warm the lambda. _(production env only)_
- Can also be used to check if the lambda is running, which node version, from which git commit, etc.

---

## Redis configuration

### Select Subscription plan
For the purpose of a Proof of Concept, we created a Redis instance on [Redis Labs](https://app.redislabs.com/#/subscription/new/plan).

One important thing not to miss when creating the Subscription, is to select the right availability zone (AZ), which depends on where you're located.
We selected `ue-west-1`, which is Ireland, because it's the closer from us.

You won't be able to select a different AZ in free plan, so choose carefully. 
The database can only be created in the same region as the one selected for the subscription.

### Database configuration

Once a subscription is created, you can create a database (our redis instance).

#### Data eviction policy
A redis instance can be configured with those values:

- `noeviction`: returns error if memory limit has been reached when trying to insert more data
- `allkeys-lru`: evicts the least recently used keys out of all keys
- `allkeys-lfu`: evicts the least frequently used keys out of all keys
- `allkeys-random`: randomly evicts keys out of all keys
- `volatile-lru`: evicts the least recently used keys out of keys with an "expire" field set
- `volatile-lfu`: evicts the least frequently used keys out of keys with an "expire" field set
- `volatile-ttl`: evicts the shortest time-to-live and least recently used keys out of keys with an "expire" field set
- `volatile-random`: randomly evicts keys with an "expire" field set

> The recommended choice is `allkeys-lfu`, so that the impact of re-fetching data is minimised as much as possible.
