/**
 * @seashore/rag - RAG Pipeline
 *
 * Retrieval-Augmented Generation pipeline implementation
 */

import type {
  RAGPipeline,
  RAGConfig,
  RAGContext,
  Retriever,
  DocumentLoader,
  DocumentSplitter,
  RetrievedDocument,
} from './types.js';

/**
 * Default system prompt template
 */
const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant. Use the following context to answer the user's question. 
If you cannot find the answer in the context, say so honestly.

Context:
{context}`;

/**
 * Format documents as plain text
 */
function formatAsText(documents: readonly RetrievedDocument[]): string {
  return documents
    .map((doc, i) => {
      const source = doc.metadata?.source ?? `Source ${i + 1}`;
      return `[${i + 1}] ${source}\n${doc.content}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Format documents as XML
 */
function formatAsXml(documents: readonly RetrievedDocument[]): string {
  return documents
    .map((doc, i) => {
      const source = doc.metadata?.source ?? `source-${i + 1}`;
      return `<document index="${i + 1}" source="${source}">\n${doc.content}\n</document>`;
    })
    .join('\n\n');
}

/**
 * Format documents as Markdown
 */
function formatAsMarkdown(documents: readonly RetrievedDocument[]): string {
  return documents
    .map((doc, i) => {
      const source = doc.metadata?.source ?? `Source ${i + 1}`;
      const title = doc.metadata?.title ?? source;
      return `### ${i + 1}. ${title}\n\n${doc.content}\n\n*Source: ${source}*`;
    })
    .join('\n\n---\n\n');
}

/**
 * Simple token estimation (characters / 4)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Create a RAG pipeline
 */
export function createRAG(config: RAGConfig): RAGPipeline {
  const {
    retriever,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    maxContextTokens = 4000,
    k = 4,
    includeSources = true,
    contextFormat = 'text',
  } = config;

  /**
   * Format documents based on configured format
   */
  function formatDocuments(documents: readonly RetrievedDocument[]): string {
    switch (contextFormat) {
      case 'xml':
        return formatAsXml(documents);
      case 'markdown':
        return formatAsMarkdown(documents);
      case 'text':
      default:
        return formatAsText(documents);
    }
  }

  /**
   * Truncate context to fit within token limit
   */
  function truncateContext(
    documents: readonly RetrievedDocument[],
    maxTokens: number
  ): readonly RetrievedDocument[] {
    const result: RetrievedDocument[] = [];
    let currentTokens = 0;

    for (const doc of documents) {
      const docTokens = estimateTokens(doc.content);

      if (currentTokens + docTokens > maxTokens) {
        // Try to fit partial document
        const remainingTokens = maxTokens - currentTokens;
        if (remainingTokens > 100) {
          // At least 100 tokens to be useful
          const truncatedContent = doc.content.slice(0, remainingTokens * 4);
          result.push({
            ...doc,
            content: truncatedContent + '...',
          });
        }
        break;
      }

      result.push(doc);
      currentTokens += docTokens;
    }

    return result;
  }

  return {
    async getContext(query: string): Promise<RAGContext> {
      // Retrieve relevant documents
      const documents = await retriever.retrieve(query, { k });

      // Truncate to fit token limit
      const truncatedDocs = truncateContext(documents, maxContextTokens);

      // Format context
      const formattedContext = formatDocuments(truncatedDocs);

      // Calculate token count
      const tokenCount = estimateTokens(formattedContext);

      return {
        formattedContext,
        documents: truncatedDocs,
        tokenCount,
      };
    },

    async ingest(
      loader: DocumentLoader,
      splitter: DocumentSplitter
    ): Promise<{ documentCount: number; chunkCount: number }> {
      // Load documents
      const loadedDocs = await loader.load();

      // Split into chunks
      const chunks = await splitter.splitDocuments(loadedDocs);

      // Add to retriever
      await retriever.addDocuments(chunks);

      return {
        documentCount: loadedDocs.length,
        chunkCount: chunks.length,
      };
    },

    getRetriever(): Retriever {
      return retriever;
    },
  };
}

/**
 * Build a prompt with RAG context
 */
export function buildRAGPrompt(
  context: RAGContext,
  systemPromptTemplate: string = DEFAULT_SYSTEM_PROMPT
): string {
  return systemPromptTemplate.replace('{context}', context.formattedContext);
}

/**
 * Create citations from retrieved documents
 */
export function createCitations(documents: readonly RetrievedDocument[]): string {
  return documents
    .map((doc, i) => {
      const source = doc.metadata?.source ?? `Source ${i + 1}`;
      const title = doc.metadata?.title;
      const page = doc.metadata?.pageNumber;

      let citation = `[${i + 1}] ${title ?? source}`;
      if (page) {
        citation += `, page ${page}`;
      }
      return citation;
    })
    .join('\n');
}

/**
 * RAG utility for question answering
 */
export interface QuestionAnswerResult {
  answer: string;
  sources: readonly RetrievedDocument[];
  context: RAGContext;
}

/**
 * Options for createRAGChain
 */
export interface RAGChainOptions extends RAGConfig {
  /**
   * Function to generate answer from context and query
   */
  generateFn: (systemPrompt: string, query: string) => Promise<string>;
}

/**
 * Create a complete RAG chain for question answering
 */
export function createRAGChain(options: RAGChainOptions) {
  const { generateFn, ...ragConfig } = options;
  const rag = createRAG(ragConfig);
  const { systemPrompt = DEFAULT_SYSTEM_PROMPT } = ragConfig;

  return {
    /**
     * Answer a question using RAG
     */
    async answer(query: string): Promise<QuestionAnswerResult> {
      // Get context
      const context = await rag.getContext(query);

      // Build prompt
      const prompt = buildRAGPrompt(context, systemPrompt);

      // Generate answer
      const answer = await generateFn(prompt, query);

      return {
        answer,
        sources: context.documents,
        context,
      };
    },

    /**
     * Get the underlying RAG pipeline
     */
    getPipeline(): RAGPipeline {
      return rag;
    },
  };
}
