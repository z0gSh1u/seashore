import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

/**
 * Create a standard Rollup config for a Seashore package.
 * @param {object} opts
 * @param {string} opts.input - Entry file path (default: 'src/index.ts')
 * @param {string[]} opts.external - Additional external dependencies
 * @param {string} opts.tsconfig - Path to tsconfig (default: 'tsconfig.json')
 */
export function createRollupConfig(opts = {}) {
  const input = opts.input ?? 'src/index.ts'
  const external = opts.external ?? []
  const tsconfig = opts.tsconfig ?? 'tsconfig.json'

  return [
    {
      input,
      output: {
        dir: 'dist',
        format: 'es',
        sourcemap: true,
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
      external: [
        /node_modules/,
        /^@tanstack\//,
        /^@seashore\//,
        ...external,
      ],
      plugins: [
        resolve(),
        commonjs(),
        typescript({
          tsconfig,
          declaration: true,
          declarationDir: 'dist',
        }),
      ],
    },
    {
      input,
      output: {
        dir: 'dist',
        format: 'es',
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
      external: [
        /node_modules/,
        /^@tanstack\//,
        /^@seashore\//,
        ...external,
      ],
      plugins: [dts({ tsconfig })],
    },
  ]
}
