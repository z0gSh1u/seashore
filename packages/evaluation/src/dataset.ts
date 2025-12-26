/**
 * Dataset management
 * @module @seashore/evaluation
 */

import type { Dataset, DatasetConfig, TestCase } from './types';

/**
 * Dataset implementation
 */
class DatasetImpl implements Dataset {
  name: string;
  description?: string;
  testCases: TestCase[];

  constructor(config: DatasetConfig) {
    this.name = config.name;
    this.description = config.description;
    this.testCases = config.testCases;
  }

  filter(predicate: (tc: TestCase) => boolean): Dataset {
    return new DatasetImpl({
      name: this.name,
      description: this.description,
      testCases: this.testCases.filter(predicate),
    });
  }

  sample(n: number): Dataset {
    const shuffled = [...this.testCases];

    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!];
    }

    return new DatasetImpl({
      name: this.name,
      description: this.description,
      testCases: shuffled.slice(0, n),
    });
  }

  split(ratio: number): [Dataset, Dataset] {
    const splitIndex = Math.floor(this.testCases.length * ratio);
    const shuffled = [...this.testCases];

    // Shuffle before splitting
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!];
    }

    const train = new DatasetImpl({
      name: `${this.name}-train`,
      description: this.description,
      testCases: shuffled.slice(0, splitIndex),
    });

    const test = new DatasetImpl({
      name: `${this.name}-test`,
      description: this.description,
      testCases: shuffled.slice(splitIndex),
    });

    return [train, test];
  }

  async save(path: string): Promise<void> {
    const data = {
      name: this.name,
      description: this.description,
      testCases: this.testCases,
    };

    // Use dynamic import for Node.js fs
    const fs = await import('node:fs/promises');
    await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
  }

  [Symbol.iterator](): Iterator<TestCase> {
    let index = 0;
    const cases = this.testCases;

    return {
      next(): IteratorResult<TestCase> {
        if (index < cases.length) {
          return { value: cases[index++]!, done: false };
        }
        return { value: undefined as unknown as TestCase, done: true };
      },
    };
  }
}

/**
 * Create a new dataset
 * @param config - Dataset configuration
 * @returns Dataset instance
 * @example
 * ```typescript
 * const dataset = createDataset({
 *   name: 'qa-tests',
 *   testCases: [
 *     { input: 'Q1', reference: 'A1' },
 *     { input: 'Q2', reference: 'A2' },
 *   ],
 * })
 * ```
 */
export function createDataset(config: DatasetConfig): Dataset {
  return new DatasetImpl(config);
}

/**
 * Load dataset from file or URL
 * @param source - File path or URL
 * @returns Dataset instance
 * @example
 * ```typescript
 * const dataset = await loadDataset('./data/tests.json')
 * const remote = await loadDataset('https://example.com/dataset.json')
 * ```
 */
export async function loadDataset(source: string): Promise<Dataset> {
  let data: DatasetConfig;

  if (source.startsWith('http://') || source.startsWith('https://')) {
    // Load from URL
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to load dataset from ${source}: ${response.statusText}`);
    }
    data = await response.json();
  } else {
    // Load from file
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(source, 'utf-8');
    data = JSON.parse(content);
  }

  return createDataset(data);
}
