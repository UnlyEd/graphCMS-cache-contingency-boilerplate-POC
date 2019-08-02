require('dotenv').config({ path: '.serverless/.env' });

if (process.env.NODE_ENV !== 'test') {
  throw Error('Non-test environment');
}
