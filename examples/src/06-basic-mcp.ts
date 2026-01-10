/**
 * Example 08 - MCP Filesystem
 *
 * 展示如何通过 MCP (Model Context Protocol) 连接外部工具服务器。
 * 此示例连接到 filesystem MCP server，让 Agent 可以操作文件系统。
 *
 * 运行前需要安装: npx -y @modelcontextprotocol/server-filesystem
 */

import 'dotenv/config';
import { createMCPClient, createMCPToolBridge } from '@seashore/mcp';
import { createAgent } from '@seashore/agent';
import { openaiText } from '@seashore/llm';
import { defineTool } from '@seashore/tool';

async function main() {
  console.log('🤖 Example 08: MCP Filesystem\n');

  // 获取当前目录作为允许访问的路径
  const allowedPath = process.cwd();
  console.log(`📂 允许访问的路径: ${allowedPath}\n`);

  try {
    // 1. 连接到 MCP 文件系统服务器
    console.log('🔌 正在连接 MCP 服务器...');
    const client = await createMCPClient({
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', allowedPath],
    });

    console.log('✅ MCP 服务器已连接\n');

    // 2. 创建工具桥接器
    const bridge = await createMCPToolBridge({
      client,
      // 可选：重命名工具以避免冲突
      rename: (name) => `fs_${name}`,
    });

    const toolConfigs = bridge.getTools();
    console.log(`🛠️ 可用工具 (${toolConfigs.length} 个):`);
    toolConfigs.forEach((tool) => {
      console.log(`   - ${tool.name}: ${tool.description?.slice(0, 50)}...`);
    });
    console.log();

    // 转换为 Seashore Tool 格式
    const tools = toolConfigs.map((config) => defineTool(config));

    // 3. 创建带 MCP 工具的 Agent
    const agent = createAgent({
      name: 'filesystem-agent',
      model: openaiText('gpt-5.1', {
        baseURL: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY || '',
      }),
      systemPrompt: `你是一个文件系统助手。你可以使用以下工具操作文件：
- fs_read_file: 读取文件内容
- fs_list_directory: 列出目录内容
- fs_get_file_info: 获取文件信息

请根据用户的请求操作文件系统，并用中文回答。`,
      tools,
    });

    // 4. 测试文件操作
    console.log('--- 文件操作测试 ---\n');

    const queries = [
      '请列出当前目录下的文件和文件夹',
      '读取 package.json 的内容，告诉我这个项目的名称和版本',
    ];

    for (const query of queries) {
      console.log(`📝 User: ${query}`);
      const result = await agent.run(query);
      console.log(`🤖 Agent: ${result.content}\n`);

      // 显示工具调用记录
      if (result.toolCalls.length > 0) {
        console.log('   📋 工具调用:');
        result.toolCalls.forEach((call) => {
          console.log(`      - ${call.name}: ${call.result.success ? '✅' : '❌'}`);
        });
        console.log();
      }
    }

    // 5. 断开连接
    await client.close();
    console.log('🔌 MCP 连接已关闭');
  } catch (error) {
    console.error('❌ MCP 连接失败:', error);
    console.log('\n💡 提示: 确保已安装 Node.js 并可以运行 npx 命令');
  }
}

main().catch(console.error);
