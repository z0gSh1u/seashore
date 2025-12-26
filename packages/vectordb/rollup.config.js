import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const baseConfig = require('../../rollup.config.base.cjs');

export default baseConfig;
