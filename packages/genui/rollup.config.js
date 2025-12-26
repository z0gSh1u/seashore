import { createRollupConfig } from '../../rollup.config.base.js';
import copy from 'rollup-plugin-copy';

const baseConfig = createRollupConfig({
  input: 'src/index.ts',
  packageDir: 'packages/genui',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});

export default {
  ...baseConfig,
  plugins: [
    ...baseConfig.plugins,
    copy({
      targets: [{ src: 'src/styles.css', dest: 'dist' }],
    }),
  ],
};
