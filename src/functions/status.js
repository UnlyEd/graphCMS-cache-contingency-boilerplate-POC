import RavenLambdaWrapper from 'serverless-sentry-lib';
import Raven from 'raven';
import moment from 'moment';

export const status = RavenLambdaWrapper.handler(Raven, async (event, context) => {
  return {
    body: JSON.stringify({
      status: 'OK',
      processNodeEnv: process.env.NODE_ENV,
      time: moment().toISOString(),
      appName: process.env.APP_NAME,
      release: process.env.SENTRY_RELEASE,
      releasedAt: process.env.DEPLOY_TIME,
      nodejs: process.version,
    }),
  };
});
