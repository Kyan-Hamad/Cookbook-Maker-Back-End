import serverless  from 'serverless-http';
import app from './lambda.mjs';

export const lambdaHandler = serverless(app);