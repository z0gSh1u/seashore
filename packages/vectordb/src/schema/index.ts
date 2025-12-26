/**
 * @seashore/vectordb - Schema Index
 *
 * Re-exports all schema definitions
 */

export { collections, type NewCollection, type SelectCollection } from './collections.js';

export {
  documents,
  vector,
  tsvector,
  generateSearchVector,
  generateSearchQuery,
  generateWebSearchQuery,
  type NewDocument,
  type SelectDocument,
} from './documents.js';
