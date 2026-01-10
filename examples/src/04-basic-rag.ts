/**
 * Example 04 - RAG Knowledge Base
 *
 * This example demonstrates how to create a simple Retrieval-Augmented Generation (RAG) knowledge base
 * using Seashore's RAG utilities. It covers loading documents, splitting them into chunks,
 * creating embeddings, and setting up an in-memory retriever.
 */

import 'dotenv/config';
import {
  createMarkdownStringLoader,
  createMarkdownSplitter,
  createInMemoryRetriever,
  type DocumentChunk,
} from '@seashore/rag';
import { openaiEmbed, generateBatchEmbeddings } from '@seashore/llm';

async function main() {
  console.log('[Example 04: RAG Knowledge Base]\n');

  // Mock knowledge base content
  const knowledgeContent = `
# Photonelectric Effect

The photoelectric effect is the emission of electrons or other free carriers when light shines on a material.
Electrons emitted in this manner can be called photoelectrons.
The phenomenon is commonly observed in metals and is the basis for photoemissive devices.

# Compton Scattering

Compton scattering is the inelastic scattering of a photon by a charged particle, usually an electron.
It results in a decrease in energy (increase in wavelength) of the photon, called the Compton effect.
This effect demonstrates that light cannot be explained purely as a wave phenomenon.

# Beer-Lambert Law
The Beer-Lambert law relates the absorption of light to the properties of the material through which the light is traveling.
It states that there is a logarithmic dependence between the transmission of light through a substance and the product of the absorption coefficient of the substance, the path length, and the concentration of absorbing species.
`;

  // Step 1 - Load documents
  console.log('📚 Step 1: Load documents');
  const loader = createMarkdownStringLoader(knowledgeContent);
  const loadedDocs = await loader.load();
  console.log(`   Loaded ${loadedDocs.length} documents\n`);

  // Step 2 - Split documents into chunks
  console.log('✂️ Step 2: Split documents');
  const splitter = createMarkdownSplitter({
    chunkSize: 200,
    chunkOverlap: 20,
    includeHeader: true,
  });
  const chunks: DocumentChunk[] = [];
  for (const doc of loadedDocs) {
    const docChunks = await splitter.split(doc);
    chunks.push(...docChunks);
  }
  console.log(`   Split into ${chunks.length} chunks\n`);
  console.log('📄 Split preview:');
  chunks.slice(0, 3).forEach((chunk, i) => {
    const preview = chunk.content.slice(0, 60).replace(/\n/g, ' ');
    console.log(`   ${i + 1}. "${preview}..."`);
  });

  // Step 3 - Create embeddings
  console.log('🔢 Step 3: Create embeddings');
  const embeddingFn = async (texts: readonly string[]): Promise<number[][]> => {
    const embedder = openaiEmbed('text-embedding-3-small');
    const result = await generateBatchEmbeddings({
      adapter: embedder,
      input: texts,
    });

    return result.embeddings as number[][];
  };

  // Step 4 - Create in-memory retriever and add chunks inside
  console.log('\n🔍 Step 4: Create in-memory retriever');
  const retriever = createInMemoryRetriever(embeddingFn);
  await retriever.addDocuments(chunks);
  console.log('   Documents added to retriever\n');

  // Step 5 - Test retrieval
  console.log('--- Test retrieval ---\n');
  const testQuestions = [
    'What is the Photoelectric Effect?',
    "How's Beer-Lambert law related to Photonelectric Effect and Compton scattering?",
  ];

  for (const question of testQuestions) {
    console.log(`📝 Question: ${question}`);
    const retrieved = await retriever.retrieve(question);
    console.log(`📋 Retrieved ${retrieved.length} relevant chunks`);
    if (retrieved.length > 0) {
      const preview = retrieved[0].content.slice(0, 80).replace(/\n/g, ' ');
      console.log(`   Most relevant: "${preview}..."`);
      console.log(`   Similarity: ${(retrieved[0].score * 100).toFixed(1)}%`);
    }
    console.log();
  }
}

main().catch(console.error);
