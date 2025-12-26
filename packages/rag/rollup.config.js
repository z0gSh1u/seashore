import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
    },
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist',
    }),
  ],
  external: [
    '@seashore/vectordb',
    '@seashore/llm',
    'zod',
    'pdf-parse',
    'node-html-parser',
    'fs',
    'fs/promises',
    'path',
    'url',
  ],
};
