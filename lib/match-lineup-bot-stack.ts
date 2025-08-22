import * as path from 'node:path'
import * as cdk from 'aws-cdk-lib'
import { RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as dynamo from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as scheduler from 'aws-cdk-lib/aws-scheduler'
import * as scheduler_targets from 'aws-cdk-lib/aws-scheduler-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as events from 'aws-cdk-lib/aws-events'
import * as events_targets from 'aws-cdk-lib/aws-events-targets'
import * as secrets from 'aws-cdk-lib/aws-secretsmanager'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'

export class MatchLineupBotStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const table = new dynamo.Table(this, 'FixturesTable', {
      tableName: 'match-bot-fixtures-table',
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'PK',
        type: dynamo.AttributeType.NUMBER
      }
    })

    const eventBus = new events.EventBus(this, 'event-bus', {
      eventBusName: 'match-bot-event-bus',
    })

    const lineupSetRule = new events.Rule(this, 'LineupSetRule', {
      eventBus: eventBus,
      eventPattern: {
        source: ['lineup-checker', 'ai-lineup-checker'],
        detailType: ['Lineup Set']
      }
    })

    const projectRoot = path.resolve(__dirname, '../')
    const lambdaRoot = path.resolve(__dirname, '../src')

    const lineupScheduleGroup = new scheduler.ScheduleGroup(this, 'LineupScheduleGroup', {
      scheduleGroupName: 'lineup-schedule-group',
    })

    const secretsLayerArn = 'arn:aws:lambda:eu-west-2:133256977650:layer:AWS-Parameters-and-Secrets-Lambda-Extension:11'
    const secretsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'secrets-layer', secretsLayerArn)

    const sharedSecrets = new secrets.Secret(this, 'shared-secrets', {
      secretName: 'match-bot/shared-secrets',
      removalPolicy: RemovalPolicy.RETAIN
    })

    const lineupCheckerRole = new iam.Role(this, 'LineCheckerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    })
    const lineupCheckerLambda = new nodejs.NodejsFunction(this, 'LineupCheckerLambda', {
      functionName: 'lineup-checker',
      runtime: lambda.Runtime.NODEJS_22_X,
      layers: [secretsLayer],
      projectRoot: projectRoot,
      entry: path.join(lambdaRoot, 'check-lineup', 'index.ts'),
      handler: 'index.handler',
      depsLockFilePath: path.join(projectRoot, 'package-lock.json'),
      bundling: {
        nodeModules: ['jsdom']
      },
      environment: {
        TABLE_NAME: table.tableName,
        EVENT_BUS_ARN: eventBus.eventBusArn,
      },
      timeout: cdk.Duration.seconds(10),
      logRetention: RetentionDays.ONE_MONTH
    })
    table.grantReadWriteData(lineupCheckerLambda)
    lineupCheckerLambda.grantInvoke(lineupCheckerRole)
    eventBus.grantPutEventsTo(lineupCheckerLambda)
    sharedSecrets.grantRead(lineupCheckerLambda)

    const aiLineupCheckerLambda = new nodejs.NodejsFunction(this, 'AILineupCheckerLambda', {
      functionName: 'ai-lineup-checker',
      runtime: lambda.Runtime.NODEJS_22_X,
      layers: [secretsLayer],
      projectRoot: projectRoot,
      entry: path.join(lambdaRoot, 'ai-check-lineup', 'index.ts'),
      handler: 'index.handler',
      depsLockFilePath: path.join(projectRoot, 'package-lock.json'),
      environment: {
        TABLE_NAME: table.tableName,
        EVENT_BUS_ARN: eventBus.eventBusArn,
        SECRET_NAME: sharedSecrets.secretName
      },
      timeout: cdk.Duration.seconds(10),
      logRetention: RetentionDays.ONE_MONTH
    })
    table.grantReadWriteData(aiLineupCheckerLambda)
    aiLineupCheckerLambda.grantInvoke(lineupCheckerRole)
    eventBus.grantPutEventsTo(aiLineupCheckerLambda)
    sharedSecrets.grantRead(aiLineupCheckerLambda)

    const fixtureCheckLambda = new nodejs.NodejsFunction(this, 'FixtureChecker', {
      functionName: 'fixture-cron',
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 1024,
      layers: [secretsLayer],
      projectRoot: projectRoot,
      entry: path.join(lambdaRoot, 'fixture-cron', 'index.ts'),
      handler: 'index.handler',
      depsLockFilePath: path.join(projectRoot, 'package-lock.json'),
      bundling: {
        nodeModules: ['jsdom']
      },
      environment: {
        LINEUP_CHECKER_ARN: lineupCheckerLambda.functionArn,
        AI_LINEUP_CHECKER_ARN: aiLineupCheckerLambda.functionArn,
        SCHEDULE_GROUP_NAME: lineupScheduleGroup.scheduleGroupName,
        SCHEDULER_ROLE_ARN: lineupCheckerRole.roleArn,
        TABLE_NAME: table.tableName,
      },
      timeout: cdk.Duration.seconds(60),
      retryAttempts: 1,
      logRetention: RetentionDays.ONE_MONTH
    })
    table.grantWriteData(fixtureCheckLambda)
    lineupScheduleGroup.grantWriteSchedules(fixtureCheckLambda)
    lineupCheckerRole.grantPassRole(fixtureCheckLambda.grantPrincipal)
    sharedSecrets.grantRead(fixtureCheckLambda)

    new scheduler.Schedule(this, 'DailyFixtureCheckSchedule', {
      scheduleName: 'daily-fixture-check',
      description: 'Runs a lambda function every day to check and sync fixtures.',
      schedule: scheduler.ScheduleExpression.cron({ minute: '0', hour: '7' }),
      target: new scheduler_targets.LambdaInvoke(fixtureCheckLambda, {}),
      timeWindow: scheduler.TimeWindow.flexible(cdk.Duration.minutes(30))
    })

    const makeLineupCallLambda = new nodejs.NodejsFunction(this, 'MakeLineupCallLambda', {
      functionName: 'make-lineup-call',
      runtime: lambda.Runtime.NODEJS_22_X,
      layers: [secretsLayer],
      projectRoot: projectRoot,
      entry: path.join(lambdaRoot, 'make-call', 'index.ts'),
      handler: 'index.handler',
      depsLockFilePath: path.join(projectRoot, 'package-lock.json'),
      environment: {
        SECRET_NAME: sharedSecrets.secretName
      },
      timeout: cdk.Duration.seconds(10),
      retryAttempts: 0,
      logRetention: RetentionDays.ONE_MONTH
    })
    sharedSecrets.grantRead(makeLineupCallLambda)
    lineupSetRule.addTarget(new events_targets.LambdaFunction(makeLineupCallLambda))
  }
}
