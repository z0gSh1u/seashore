# AWS Lambda 部署

将 Seashore 代理作为无服务器函数部署到 AWS Lambda，使用 API Gateway 提供 HTTP 端点和事件驱动架构。

## 为什么选择 AWS Lambda？

- **按执行付费** - 空闲时无成本
- **自动扩展** - 从 0 到数千个并发执行
- **深度 AWS 集成** - S3、DynamoDB、SQS、EventBridge 等
- **15 分钟超时** - 适合长时间运行的任务
- **区域部署** - 靠近您的数据运行

## 权衡

**优点：**
- 对可变工作负载具有成本效益
- 无需管理基础设施
- 与 AWS 生态系统集成
- 支持事件驱动架构

**缺点：**
- 冷启动延迟（100ms-5s）
- 无状态执行
- VPC 设置数据库较复杂
- AWS 特定部署

---

## 前置要求

- AWS 账号
- 已配置 AWS CLI
- Node.js 20+
- SAM CLI 或 Serverless Framework（可选）

```bash
# Install AWS CLI
# macOS
brew install awscli

# Configure
aws configure
```

---

## 快速开始

### 1. 创建 Lambda 函数

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

### 2. 构建脚本

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

### 3. 部署脚本

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

## CloudFormation 模板

用于可重现部署的基础设施即代码：

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

### 使用 SAM 部署

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

## 数据库连接

### 方案 1：RDS Proxy（推荐）

为 Lambda 处理连接池。

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

### 方案 2：DynamoDB（无服务器）

无需连接管理。

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

## 事件驱动模式

### S3 触发器

处理上传的文档：

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

### SQS 队列

从队列处理消息：

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

### EventBridge 定时任务

按计划运行代理：

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

## 冷启动优化

### 1. 预配并发

保持 Lambda 温暖：

```yaml
Resources:
  SeashoreAgentFunction:
    Type: AWS::Serverless::Function
    Properties:
      # ... other properties ...
      ProvisionedConcurrencyConfig:
        ProvisionedConcurrentExecutions: 5
```

**成本：** 每个并发执行约每月 $5

### 2. Lambda SnapStart（仅 Java）

Node.js 尚不可用。

### 3. 最小化依赖

```typescript
// Use dynamic imports for large dependencies
export const handler = async (event) => {
  // Only load when needed
  const { createReActAgent } = await import('@seashore/agent');
  
  // ... rest of handler ...
};
```

### 4. ARM 架构

Graviton2 更快更便宜：

```yaml
Architectures:
  - arm64  # vs x86_64
```

---

## 环境变量和密钥

### 使用 AWS Secrets Manager

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

### 使用 Parameter Store

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

## 监控和日志

### CloudWatch Logs

自动记录日志：

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

自定义指标：

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

### X-Ray 追踪

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

## API Gateway 功能

### 请求验证

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

### 限流

```yaml
UsagePlan:
  Type: AWS::ApiGateway::UsagePlan
  Properties:
    Throttle:
      RateLimit: 100    # Requests per second
      BurstLimit: 200   # Burst capacity
```

### 缓存

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

## 成本优化

### 1. 正确调整内存大小

更多内存 = 更多 CPU，但成本更高。测试以找到最佳值：

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

### 2. 使用 ARM

比 x86 便宜约 20%：

```yaml
Architectures:
  - arm64
```

### 3. 减小包大小

更小的包 = 更快的冷启动 = 更低的成本：

```bash
# Check package size
du -sh dist/function.zip

# Should be < 10MB for best performance
```

### 4. 监控成本

设置账单警报：

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

## 故障排除

### 冷启动太慢

- 使用预配并发
- 减小包大小
- 使用 ARM 架构
- 最小化依赖

### 超时错误

```bash
# Increase timeout
aws lambda update-function-configuration \
  --function-name seashore-agent \
  --timeout 300  # 5 minutes
```

### 内存不足

```bash
# Increase memory
aws lambda update-function-configuration \
  --function-name seashore-agent \
  --memory-size 2048
```

### VPC 连接问题

- 检查安全组
- 确保 NAT 网关用于互联网访问
- 验证 RDS Proxy 配置

---

## 下一步

- [环境变量 →](./environment.md)
- [监控设置 →](./monitoring.md)
- [Docker 比较 →](./docker.md)

## 其他资源

- [AWS Lambda 文档](https://docs.aws.amazon.com/lambda/)
- [AWS SAM 文档](https://docs.aws.amazon.com/serverless-application-model/)
- [Lambda 最佳实践](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
