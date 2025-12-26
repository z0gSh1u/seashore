import { createRollupConfig } from '../../rollup.config.base.js';

export default createRollupConfig({
  input: 'src/index.ts',
  packageDir: 'packages/mcp',
});
