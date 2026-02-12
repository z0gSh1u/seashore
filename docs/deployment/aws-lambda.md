# AWS Lambda Deployment

Deploy Seashore agents as serverless functions on AWS Lambda with API Gateway for HTTP endpoints and event-driven architectures.

## Why AWS Lambda?

- **Pay per execution** - No cost when idle
- **Auto-scaling** - From 0 to thousands of concurrent executions
- **Deep AWS integration** - S3, DynamoDB, SQS, EventBridge, etc.
- **15-minute timeout** - Suitable for long-running tasks
- **Regional deployment** - Run close to your data

## Trade-offs

**Pros:**
- Cost-effective for variable workloads
- No infrastructure management
- Integrated with AWS ecosystem
- Event-driven architecture support

**Cons:**
- Cold start latency (100ms-5s)
- Stateless execution
- Complex VPC setup for databases
- AWS-specific deployment

---

## Prerequisites

- AWS account
- AWS CLI configured
- Node.js 20+
- SAM CLI or Serverless Framework (optional)

```bash
# Install AWS CLI
# macOS
brew install awscli

# Configure
aws configure
```

---

## Quick Start

### 1. Create Lambda Function

```typescript
// src/handler.ts
import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLLMAdapter } from '@seashore/core';
import { createReActAgent } from '@seashore/agent';

// Initialize outside handler for reuse (Lambda container reuse)
let agent: ReturnType<typeof createReActAgent> | null = null;

const initializeAgent = () => {
  if (!agent) {
    const llm = createLLMAdapter({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY!,
    });
    
    agent = createReActAgent({
      llm,
      tools: [],
      maxIterations: 5,
    });
  }
  return agent;
};

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  
  // Handle OPTIONS request (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }
  
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { message } = body;
    
    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' }),
      };
    }
    
    // Initialize agent (reuses if container is warm)
    const agentInstance = initializeAgent();
    
    // Run agent
    const result = await agentInstance.run({ message });
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: result.message,
        requestId: event.requestContext.requestId,
      }),
    };
    
  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
    };
  }
};
```

### 2. Build Script

```typescript
// build.ts
import { build } from 'esbuild';

await build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/handler.js',
  format: 'cjs',  // Lambda requires CommonJS
  external: ['aws-sdk'],  // AWS SDK is provided by Lambda
  minify: true,
  sourcemap: true,
});
```

```json
// package.json
{
  "scripts": {
    "build": "tsx build.ts",
    "deploy": "pnpm build && ./deploy.sh"
  }
}
```

### 3. Deploy Script

```bash
#!/bin/bash
# deploy.sh
set -e

FUNCTION_NAME="seashore-agent"
REGION="us-east-1"

echo "Building..."
pnpm build

echo "Creating deployment package..."
cd dist
zip -r function.zip handler.js handler.js.map
cd ..

echo "Deploying to Lambda..."
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://dist/function.zip \
  --region $REGION

echo "Updating configuration..."
aws lambda update-function-configuration \
  --function-name $FUNCTION_NAME \
  --timeout 60 \
  --memory-size 1024 \
  --environment "Variables={OPENAI_API_KEY=$OPENAI_API_KEY}" \
  --region $REGION

echo "Deployment complete!"
```

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## CloudFormation Template

Infrastructure as code for reproducible deployments:

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Seashore Agent API

Globals:
  Function:
    Timeout: 60
    MemorySize: 1024
    Runtime: nodejs20.x
    Architectures:
      - arm64  # Graviton2 (cheaper)
    Environment:
      Variables:
        NODE_ENV: production

Resources:
  # Lambda Function
  SeashoreAgentFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: seashore-agent
      CodeUri: dist/
      Handler: handler.handler
      Environment:
        Variables:
          OPENAI_API_KEY: !Ref OpenAIApiKey
      Events:
        ChatApi:
          Type: Api
          Properties:
            Path: /chat
            Method: post
            RestApiId: !Ref SeashoreApi
      
  # API Gateway
  SeashoreApi:
    Type: AWS::Serverless::Api
    Properties:
      Name: seashore-api
      StageName: prod
      Cors:
        AllowOrigin: "'*'"
        AllowMethods: "'POST, OPTIONS'"
        AllowHeaders: "'Content-Type, Authorization'"
      Auth:
        ApiKeyRequired: true
  
  # API Key
  ApiKey:
    Type: AWS::ApiGateway::ApiKey
    Properties:
      Name: seashore-api-key
      Enabled: true
  
  # Usage Plan
  UsagePlan:
    Type: AWS::ApiGateway::UsagePlan
    DependsOn: SeashoreApiProdStage
    Properties:
      ApiStages:
        - ApiId: !Ref SeashoreApi
          Stage: prod
      Quota:
        Limit: 10000
        Period: MONTH
      Throttle:
        RateLimit: 100
        BurstLimit: 200
  
  # Link API Key to Usage Plan
  UsagePlanKey:
    Type: AWS::ApiGateway::UsagePlanKey
    Properties:
      KeyId: !Ref ApiKey
      KeyType: API_KEY
      UsagePlanId: !Ref UsagePlan

Parameters:
  OpenAIApiKey:
    Type: String
    NoEcho: true
    Description: OpenAI API Key

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${SeashoreApi}.execute-api.${AWS::Region}.amazonaws.com/prod'
  
  ApiKeyId:
    Description: API Key ID
    Value: !Ref ApiKey
```

### Deploy with SAM

```bash
# Build
sam build

# Deploy (first time - guided)
sam deploy --guided

# Deploy (subsequent)
sam deploy

# Get API endpoint
sam list endpoints --stack-name seashore-agent
```

---

## Database Connection

### Option 1: RDS Proxy (Recommended)

Handles connection pooling for Lambda.

```yaml
# Add to template.yaml
Resources:
  RDSProxy:
    Type: AWS::RDS::DBProxy
    Properties:
      DBProxyName: seashore-proxy
      EngineFamily: POSTGRESQL
      Auth:
        - AuthScheme: SECRETS
          SecretArn: !Ref DBSecret
      RoleArn: !GetAtt DBProxyRole.Arn
      VpcSubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
      
  SeashoreAgentFunction:
    Type: AWS::Serverless::Function
    Properties:
      # ... other properties ...
      VpcConfig:
        SecurityGroupIds:
          - !Ref LambdaSecurityGroup
        SubnetIds:
          - !Ref PrivateSubnet1
          - !Ref PrivateSubnet2
      Environment:
        Variables:
          DATABASE_URL: !GetAtt RDSProxy.Endpoint
```

```typescript
// In handler
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.RDS_PROXY_ENDPOINT,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 1,  // Lambda: 1 connection per instance
});

// Use in agent
const result = await pool.query('SELECT * FROM documents');
```

### Option 2: DynamoDB (Serverless)

No connection management needed.

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Store conversation
await docClient.send(new PutCommand({
  TableName: 'conversations',
  Item: {
    threadId: 'thread-123',
    timestamp: Date.now(),
    message: 'Hello',
    response: 'Hi there!',
  },
}));

// Retrieve conversation
const { Items } = await docClient.send(new QueryCommand({
  TableName: 'conversations',
  KeyConditionExpression: 'threadId = :threadId',
  ExpressionAttributeValues: {
    ':threadId': 'thread-123',
  },
}));
```

---

## Event-Driven Patterns

### S3 Trigger

Process uploaded documents:

```yaml
# template.yaml
Resources:
  DocumentProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: processor.handler
      Events:
        S3Upload:
          Type: S3
          Properties:
            Bucket: !Ref DocumentBucket
            Events: s3:ObjectCreated:*
            Filter:
              S3Key:
                Rules:
                  - Name: suffix
                    Value: .pdf
```

```typescript
// processor.ts
import { S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({});

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;
    
    // Download file
    const response = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    
    const content = await response.Body?.transformToString();
    
    // Process with agent
    const agent = initializeAgent();
    const result = await agent.run({
      message: `Summarize this document: ${content}`,
    });
    
    console.log('Summary:', result.message);
  }
};
```

### SQS Queue

Process messages from queue:

```yaml
Resources:
  QueueProcessorFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: queue.handler
      Events:
        SQSEvent:
          Type: SQS
          Properties:
            Queue: !GetAtt MessageQueue.Arn
            BatchSize: 10
  
  MessageQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: seashore-tasks
      VisibilityTimeout: 300
```

### EventBridge Schedule

Run agent on schedule:

```yaml
Resources:
  ScheduledFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: scheduled.handler
      Events:
        DailyReport:
          Type: Schedule
          Properties:
            Schedule: cron(0 9 * * ? *)  # 9 AM UTC daily
```

---

## Cold Start Optimization

### 1. Provisioned Concurrency

Keep Lambda warm:

```yaml
Resources:
  SeashoreAgentFunction:
    Type: AWS::Serverless::Function
    Properties:
      # ... other properties ...
      ProvisionedConcurrencyConfig:
        ProvisionedConcurrentExecutions: 5
```

**Cost:** ~$5/month per concurrent execution

### 2. Lambda SnapStart (Java only)

Not available for Node.js yet.

### 3. Minimize Dependencies

```typescript
// Use dynamic imports for large dependencies
export const handler = async (event) => {
  // Only load when needed
  const { createReActAgent } = await import('@seashore/agent');
  
  // ... rest of handler ...
};
```

### 4. ARM Architecture

Graviton2 is faster and cheaper:

```yaml
Architectures:
  - arm64  # vs x86_64
```

---

## Environment Variables & Secrets

### Using AWS Secrets Manager

```yaml
Resources:
  SeashoreAgentFunction:
    Type: AWS::Serverless::Function
    Properties:
      Policies:
        - AWSSecretsManagerGetSecretValuePolicy:
            SecretArn: !Ref OpenAISecret
```

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManagerClient({});

const getSecret = async (secretId: string): Promise<string> => {
  const response = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );
  return response.SecretString!;
};

// Use in handler
const apiKey = await getSecret('prod/openai/api-key');
```

### Using Parameter Store

```typescript
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});

const getParameter = async (name: string): Promise<string> => {
  const response = await ssm.send(
    new GetParameterCommand({
      Name: name,
      WithDecryption: true,
    })
  );
  return response.Parameter!.Value!;
};
```

---

## Monitoring & Logging

### CloudWatch Logs

Automatic logging:

```typescript
export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  console.log('Processing message...');
  
  try {
    // ... logic ...
    console.log('Success:', result);
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

### CloudWatch Metrics

Custom metrics:

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({});

const putMetric = async (name: string, value: number) => {
  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: 'Seashore/Agent',
    MetricData: [{
      MetricName: name,
      Value: value,
      Unit: 'Count',
      Timestamp: new Date(),
    }],
  }));
};

// Usage
await putMetric('AgentInvocations', 1);
await putMetric('TokensUsed', result.tokensUsed);
```

### X-Ray Tracing

```yaml
Resources:
  SeashoreAgentFunction:
    Type: AWS::Serverless::Function
    Properties:
      Tracing: Active
```

```typescript
import { captureAWS, captureHTTPs } from 'aws-xray-sdk-core';

// Instrument AWS SDK
const AWS = captureAWS(require('aws-sdk'));

// Instrument HTTP
const https = captureHTTPs(require('https'));
```

---

## API Gateway Features

### Request Validation

```yaml
Resources:
  SeashoreApi:
    Type: AWS::Serverless::Api
    Properties:
      Models:
        ChatRequest:
          type: object
          required:
            - message
          properties:
            message:
              type: string
              minLength: 1
              maxLength: 10000
```

### Rate Limiting

```yaml
UsagePlan:
  Type: AWS::ApiGateway::UsagePlan
  Properties:
    Throttle:
      RateLimit: 100    # Requests per second
      BurstLimit: 200   # Burst capacity
```

### Caching

```yaml
SeashoreApi:
  Type: AWS::Serverless::Api
  Properties:
    CacheClusterEnabled: true
    CacheClusterSize: '0.5'
    MethodSettings:
      - ResourcePath: '/chat'
        HttpMethod: POST
        CachingEnabled: false  # Don't cache dynamic content
```

---

## Cost Optimization

### 1. Right-Size Memory

More memory = more CPU, but higher cost. Test to find optimal:

```bash
# Test different memory sizes
for mem in 512 1024 2048; do
  aws lambda update-function-configuration \
    --function-name seashore-agent \
    --memory-size $mem
  
  # Run load test
  # Compare cost vs performance
done
```

### 2. Use ARM

~20% cheaper than x86:

```yaml
Architectures:
  - arm64
```

### 3. Reduce Package Size

Smaller packages = faster cold starts = lower cost:

```bash
# Check package size
du -sh dist/function.zip

# Should be < 10MB for best performance
```

### 4. Monitor Costs

Set up billing alerts:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name lambda-cost-alert \
  --alarm-description "Alert when Lambda costs exceed $100" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold
```

---

## Troubleshooting

### Cold Start Too Slow

- Use provisioned concurrency
- Reduce package size
- Use ARM architecture
- Minimize dependencies

### Timeout Errors

```bash
# Increase timeout
aws lambda update-function-configuration \
  --function-name seashore-agent \
  --timeout 300  # 5 minutes
```

### Out of Memory

```bash
# Increase memory
aws lambda update-function-configuration \
  --function-name seashore-agent \
  --memory-size 2048
```

### VPC Connection Issues

- Check security groups
- Ensure NAT gateway for internet access
- Verify RDS Proxy configuration

---

## Next Steps

- [Environment variables →](./environment.md)
- [Monitoring setup →](./monitoring.md)
- [Docker comparison →](./docker.md)

## Additional Resources

- [AWS Lambda Docs](https://docs.aws.amazon.com/lambda/)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
