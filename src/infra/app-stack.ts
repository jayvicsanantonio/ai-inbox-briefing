import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2i from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // SSM parameter name for secrets (created manually)
    const secretsParamName = '/ai-inbox-briefing/secrets';

    // S3 bucket for audio files
    const bucket = new s3.Bucket(this, 'AudioBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{ expiration: cdk.Duration.days(2) }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // DynamoDB table for summary records
    const table = new dynamodb.Table(this, 'Summaries', {
      partitionKey: {
        name: 'summaryId',
        type: dynamodb.AttributeType.STRING,
      },
      timeToLiveAttribute: 'expiresAt',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // HTTP API Gateway
    const httpApi = new apigwv2.HttpApi(this, 'Api');

    // TwiML Lambda function
    const twimlFn = new nodejs.NodejsFunction(this, 'TwimlFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambdas/twiml.ts',
      handler: 'handler',
      memorySize: 512,
      environment: {
        AUDIO_BUCKET: bucket.bucketName,
        SUMMARY_TABLE: table.tableName,
        SECRETS_PARAM: secretsParamName,
      },
    });

    // Add /twiml route
    httpApi.addRoutes({
      path: '/twiml',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: new apigwv2i.HttpLambdaIntegration(
        'TwimlIntegration',
        twimlFn
      ),
    });

    // Daily Lambda function
    const dailyFn = new nodejs.NodejsFunction(this, 'DailyFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambdas/daily.ts',
      handler: 'handler',
      timeout: cdk.Duration.minutes(2),
      memorySize: 1024,
      environment: {
        AUDIO_BUCKET: bucket.bucketName,
        SUMMARY_TABLE: table.tableName,
        SECRETS_PARAM: secretsParamName,
        API_BASE_URL: httpApi.url ?? '',
      },
    });

    // Grant permissions
    bucket.grantReadWrite(dailyFn);
    bucket.grantRead(twimlFn);
    table.grantReadWriteData(dailyFn);
    table.grantReadData(twimlFn);

    // Allow lambdas to read SSM parameter
    const ssmPolicy = new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter${secretsParamName}`,
      ],
    });
    dailyFn.addToRolePolicy(ssmPolicy);
    twimlFn.addToRolePolicy(ssmPolicy);

    // Scheduler role to invoke daily lambda
    const schedRole = new iam.Role(this, 'SchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    dailyFn.grantInvoke(schedRole);

    // EventBridge Scheduler - 11:00 AM Pacific Time
    new scheduler.CfnSchedule(this, 'Daily11am', {
      flexibleTimeWindow: { mode: 'OFF' },
      scheduleExpression: 'cron(0 11 * * ? *)',
      scheduleExpressionTimezone: 'America/Los_Angeles',
      target: {
        arn: dailyFn.functionArn,
        roleArn: schedRole.roleArn,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'TwimlEndpoint', {
      value: `${httpApi.url}twiml`,
      description: 'TwiML endpoint URL for Twilio',
    });

    new cdk.CfnOutput(this, 'AudioBucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket for audio files',
    });

    new cdk.CfnOutput(this, 'SummaryTableName', {
      value: table.tableName,
      description: 'DynamoDB table for summaries',
    });
  }
}
