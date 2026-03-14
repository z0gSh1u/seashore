/**
 * Example: Multi-Agent System
 *
 * Purpose: Demonstrates orchestrating multiple specialized agents using workflows.
 *          Shows how to build a content creation pipeline with different agent roles.
 *
 * Prerequisites:
 * - OPENAI_API_KEY in .env file
 *
 * Learning Objectives:
 * 1. How to create specialized agents for different tasks
 * 2. How to orchestrate agents using DAG workflows
 * 3. How to pass context between agents
 * 4. How to implement a content creation pipeline
 *
 * Expected Output:
 * ```
 * 🤝 Multi-Agent System Example
 *
 * Initializing specialized agents...
 * ✓ Research Agent
 * ✓ Writer Agent
 * ✓ Editor Agent
 *
 * Executing content creation workflow...
 *
 * Step 1: Research Agent
 *    → Analyzing topic: "Artificial Intelligence in Healthcare"
 *    → Key findings: [list of research points]
 *
 * Step 2: Writer Agent
 *    → Creating article based on research
 *    → Draft complete: [article content]
 *
 * Step 3: Editor Agent
 *    → Reviewing and refining content
 *    → Final polish: [improved content]
 *
 * ✅ Final Output:
 * [Complete polished article]
 *
 * Workflow completed successfully!
 * ```
 */

import { createLLMAdapter } from '@seashore/core.js'
import { createReActAgent, createWorkflow, createStep, type WorkflowContext } from '@seashore/agent.js'
import { chat } from '@tanstack/ai'

// Validate environment variables
const apiKey = process.env.OPENAI_API_KEY
const baseURL = process.env.OPENAI_BASE_URL

if (!apiKey) {
  console.error('❌ Error: OPENAI_API_KEY is required')
  console.error('Please copy .env.example to .env and add your OpenAI API key')
  process.exit(1)
}

async function main(): Promise<void> {
  console.log('🤝 Multi-Agent System Example\n')

  // Step 1: Initialize LLM adapter
  const adapter = createLLMAdapter({
    provider: 'openai',
    apiKey,
    baseURL,
  })

  console.log('Creating specialized agents...\n')

  // Step 2: Create specialized agents

  // Agent 1: Researcher - Gathers information and key points
  const researchAgent = createReActAgent({
    model: () => adapter('gpt-4o-mini'),
    systemPrompt:
      'You are a research specialist. Your job is to analyze topics and extract key points, ' +
      'facts, and insights. Be thorough and provide structured research notes. ' +
      'Always return your findings as a bulleted list with main topics and sub-points.',
  })

  // Agent 2: Writer - Creates content based on research
  const writerAgent = createReActAgent({
    model: () => adapter('gpt-4o-mini'),
    systemPrompt:
      'You are a content writer. Your job is to create engaging, well-structured articles ' +
      'based on research notes. Write in a clear, accessible style. ' +
      'Include an introduction, main body with headings, and a conclusion.',
  })

  // Agent 3: Editor - Reviews and polishes content
  const editorAgent = createReActAgent({
    model: () => adapter('gpt-4o-mini'),
    systemPrompt:
      'You are an editor. Your job is to review content and improve it for clarity, ' +
      'flow, and impact. Fix any grammatical issues, improve transitions, ' +
      'and ensure the content achieves its purpose. Return the polished version.',
  })

  console.log('✓ Research Agent created')
  console.log('✓ Writer Agent created')
  console.log('✓ Editor Agent created\n')

  // Step 3: Define the content creation workflow
  const topic = 'Artificial Intelligence in Healthcare'
  console.log(`Creating workflow for topic: "${topic}"\n`)

  const workflow = createWorkflow({
    name: 'content-creation-pipeline',
  })

  // Workflow Step 1: Research
  const researchStep = createStep({
    name: 'research',
    execute: async (_input: undefined, ctx: WorkflowContext) => {
      console.log('🔍 Step 1: Research Agent analyzing topic...\n')

      const research = await researchAgent.run([
        {
          role: 'user',
          content: `Research the topic: "${topic}". ` +
            `Identify 5-7 key points, trends, and important facts. ` +
            `Focus on current applications, benefits, and challenges.`,
        },
      ])

      console.log('Research findings:')
      console.log(research.result.content)
      console.log()

      // Store in workflow context for next step
      ctx.state.set('researchNotes', research.result.content)

      return research.result.content
    },
  })

  // Workflow Step 2: Writing (depends on research)
  const writingStep = createStep({
    name: 'writing',
    execute: async (_input: undefined, ctx: WorkflowContext) => {
      console.log('✍️  Step 2: Writer Agent creating article...\n')

      const researchNotes = ctx.state.get('researchNotes') as string

      const draft = await writerAgent.run([
        {
          role: 'user',
          content: `Create a blog article about "${topic}" based on this research:\n\n` +
            `${researchNotes}\n\n` +
            `Write an engaging article (400-600 words) with:\n` +
            `- A catchy title\n` +
            `- An engaging introduction\n` +
            `- 3-4 main sections with subheadings\n` +
            `- A compelling conclusion`,
        },
      ])

      console.log('First draft:')
      console.log(draft.result.content.substring(0, 300) + '...\n')

      // Store draft
      ctx.state.set('draft', draft.result.content)

      return draft.result.content
    },
  })

  // Workflow Step 3: Editing (depends on writing)
  const editingStep = createStep({
    name: 'editing',
    execute: async (_input: undefined, ctx: WorkflowContext) => {
      console.log('📝 Step 3: Editor Agent polishing content...\n')

      const draft = ctx.state.get('draft') as string

      const edited = await editorAgent.run([
        {
          role: 'user',
          content: `Review and improve this article about "${topic}":\n\n` +
            `${draft}\n\n` +
            `Please:\n` +
            `1. Fix any grammar or spelling issues\n` +
            `2. Improve clarity and flow\n` +
            `3. Ensure the structure is logical\n` +
            `4. Enhance the conclusion\n` +
            `5. Return the complete polished article`,
        },
      ])

      console.log('Polished version (first 300 chars):')
      console.log(edited.result.content.substring(0, 300) + '...\n')

      // Store final result
      ctx.state.set('finalArticle', edited.result.content)

      return edited.result.content
    },
  })

  // Build workflow with dependencies
  workflow
    .step(researchStep)
    .step(writingStep, { after: 'research' })
    .step(editingStep, { after: 'writing' })

  // Step 4: Execute workflow
  console.log('=' .repeat(80))
  console.log('🚀 Executing workflow...\n')

  const result = await workflow.execute()

  // Step 5: Handle results
  if (result.status === 'completed') {
    console.log('=' .repeat(80))
    console.log('\n✅ Workflow completed successfully!\n')

    const finalArticle = result.state.get('finalArticle') as string
    const researchNotes = result.state.get('researchNotes') as string

    console.log('📋 FINAL ARTICLE:')
    console.log('=' .repeat(80))
    console.log(finalArticle)
    console.log('=' .repeat(80))

    console.log('\n\n📊 Workflow Summary:')
    console.log(`  Topic: ${topic}`)
    console.log(`  Research notes length: ${researchNotes.length} characters`)
    console.log(`  Final article length: ${finalArticle.length} characters`)
    console.log(`  Steps completed: 3/3`)

    // Bonus: Demonstrate parallel agent execution
    console.log('\n\n---\n')
    await demonstrateParallelAgents(adapter)
  } else {
    console.error('\n❌ Workflow failed:', result.error?.message)
    process.exit(1)
  }
}

/**
 * Bonus: Demonstrate multiple agents working in parallel
 */
async function demonstrateParallelAgents(adapter: any): Promise<void> {
  console.log('🔄 Bonus: Parallel Agent Execution\n')

  // Create specialized agents for different aspects
  const sentimentAgent = createReActAgent({
    model: () => adapter('gpt-4o-mini'),
    systemPrompt: 'You analyze sentiment. Rate the text on a scale of -1 (negative) to +1 (positive).',
  })

  const summaryAgent = createReActAgent({
    model: () => adapter('gpt-4o-mini'),
    systemPrompt: 'You summarize text. Create a one-sentence summary.',
  })

  const keywordsAgent = createReActAgent({
    model: () => adapter('gpt-4o-mini'),
    systemPrompt: 'You extract keywords. List the top 5 keywords from the text.',
  })

  const sampleText = 'AI is revolutionizing healthcare by enabling faster diagnosis, ' +
    'personalized treatment plans, and predictive analytics. ' +
    'This technology has the potential to save millions of lives.'

  console.log('Analyzing text with 3 agents in parallel...\n')
  console.log(`Text: "${sampleText}"\n`)

  const startTime = Date.now()

  // Run all three agents in parallel
  const [sentimentResult, summaryResult, keywordsResult] = await Promise.all([
    sentimentAgent.run([
      { role: 'user', content: `Analyze sentiment: "${sampleText}"` },
    ]),
    summaryAgent.run([
      { role: 'user', content: `Summarize: "${sampleText}"` },
    ]),
    keywordsAgent.run([
      { role: 'user', content: `Extract keywords: "${sampleText}"` },
    ]),
  ])

  const duration = Date.now() - startTime

  console.log('Results:')
  console.log(`  📊 Sentiment: ${sentimentResult.result.content}`)
  console.log(`  📝 Summary: ${summaryResult.result.content}`)
  console.log(`  🏷️  Keywords: ${keywordsResult.result.content}`)
  console.log(`\n⏱️  Total time: ${duration}ms (3 agents in parallel)`)
}

// Run with error handling
main().catch((error: Error) => {
  console.error('\n💥 Fatal error:', error.message)
  process.exit(1)
})
