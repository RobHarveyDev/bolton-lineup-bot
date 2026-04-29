#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MatchLineupBotStack } from '../lib/match-lineup-bot-stack';

const sentryDsn = process.env.SENTRY_DSN
if (!sentryDsn) {
  console.error('Error: SENTRY_DSN environment variable is required')
  process.exit(1)
}

const app = new cdk.App();
new MatchLineupBotStack(app, 'MatchLineupBotStack', {
  sentryDsn,
});