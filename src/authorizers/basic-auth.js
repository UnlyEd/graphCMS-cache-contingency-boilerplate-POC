import { createLogger } from '@unly/utils-simple-logger';
import Raven from 'raven';

require('dotenv').config({ path: '.serverless/.env' });

const logger = createLogger({
  label: 'Cache handler',
});

const UNAUTHORIZED_HTTP_RESPONSE = 'Unauthorized'; // Returns special HTTP string that's expected by the browser, must not be used to display an error message. Will force re-prompt credentials dialog box to the end-user.

if (!process.env.BASIC_AUTH_USERNAME || !process.env.BASIC_AUTH_PASSWORD) {
  throw Error(`No "BASIC_AUTH_USERNAME" or "BASIC_AUTH_PASSWORD" defined as environment variable, please make sure you've defined "CACHE_BASE_URL" in the .env.${process.env.NODE_ENV} file.`);
}

exports.handler = function (event, context, callback) {
  if(process.env.NODE_ENV === 'development'){
    // XXX In dev env, we don't want to be bothered with basic-auth (which isn't handled properly and display 401, because there is no API GW on our local machine)
    callback(null, buildAllowAllPolicy(event, 'bypass-security')); // Send any non-empty username bypasses the policy, and force the authorizer to allow
  }

  let authorizationHeader = event.headers.Authorization;

  if (!authorizationHeader) {
    Raven.captureMessage(`[Basic-Auth] Authentication failure - No credentials provided`, {
      level: 'warning',
    });
    return callback(UNAUTHORIZED_HTTP_RESPONSE);
  }

  let encodedCreds = authorizationHeader.split(' ')[1];
  let plainCreds = (new Buffer(encodedCreds, 'base64')).toString().split(':');
  let username = plainCreds[0];
  let password = plainCreds[1];

  if (!(username === process.env.BASIC_AUTH_USERNAME && password === process.env.BASIC_AUTH_PASSWORD)) {
    Raven.captureMessage(`[Basic-Auth] Authentication failure - Wrong credentials provided (username: "${username}" | password: "${password}")`, {
      level: 'warning',
    });
    return callback(UNAUTHORIZED_HTTP_RESPONSE);
  }

  callback(null, buildAllowAllPolicy(event, username));
};

// See https://medium.com/@Da_vidgf/http-basic-auth-with-api-gateway-and-serverless-5ae14ad0a270
function buildAllowAllPolicy(event, principalId) {
  let apiOptions = {};
  let tmp = event.methodArn.split(':');
  let apiGatewayArnTmp = tmp[5].split('/');
  let awsAccountId = tmp[4];
  let awsRegion = tmp[3];
  let restApiId = apiGatewayArnTmp[0];
  let stage = apiGatewayArnTmp[1];
  let apiArn = 'arn:aws:execute-api:' + awsRegion + ':' + awsAccountId + ':' +
    restApiId + '/' + stage + '/*/*';

  const policy = {
    principalId: principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: [apiArn],
        },
      ],
    },
  };
  return policy;
}
