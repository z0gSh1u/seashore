/**
 * Exporters module
 * @module @seashore/observability
 */

export { createOTLPExporter, type OTLPExporterConfig } from './otlp.js';
export { createConsoleExporter, type ConsoleExporterConfig } from './console.js';
