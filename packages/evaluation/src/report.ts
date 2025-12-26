/**
 * Evaluation report generation
 * @module @seashore/evaluation
 */

import type {
  ReportConfig,
  EvaluationReport,
  BatchEvaluationResult,
  EvaluationResult,
} from './types.js';

/**
 * Calculate standard deviation
 */
function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Generate score distribution
 */
function generateDistribution(results: EvaluationResult[]): {
  buckets: number[];
  counts: number[];
} {
  const buckets = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const counts = new Array(buckets.length - 1).fill(0);

  for (const result of results) {
    const score = result.overallScore;
    for (let i = 0; i < buckets.length - 1; i++) {
      if (score >= buckets[i] && score < buckets[i + 1]) {
        counts[i]++;
        break;
      }
    }
    if (score === 1.0) {
      counts[counts.length - 1]++;
    }
  }

  return { buckets, counts };
}

/**
 * Generate Markdown report
 */
function generateMarkdown(
  results: BatchEvaluationResult,
  metricStats: EvaluationReport['metricStats'],
  options: ReportConfig['options']
): string {
  const lines: string[] = [];

  lines.push('# Evaluation Report');
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push(`**Duration:** ${results.durationMs}ms`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Cases | ${results.results.length} |`);
  lines.push(`| Passed | ${results.passedCount} |`);
  lines.push(`| Failed | ${results.failedCount} |`);
  lines.push(`| Pass Rate | ${(results.passRate * 100).toFixed(1)}% |`);
  lines.push(`| Average Score | ${results.overallAverage.toFixed(3)} |`);
  lines.push('');

  if (options?.includeMetricBreakdown) {
    lines.push('## Metric Breakdown');
    lines.push('');
    lines.push('| Metric | Average | Min | Max | Std Dev | Pass Rate |');
    lines.push('|--------|---------|-----|-----|---------|-----------|');

    for (const [name, stats] of Object.entries(metricStats)) {
      lines.push(
        `| ${name} | ${stats.average.toFixed(3)} | ${stats.min.toFixed(3)} | ${stats.max.toFixed(3)} | ${stats.stdDev.toFixed(3)} | ${(stats.passRate * 100).toFixed(1)}% |`
      );
    }
    lines.push('');
  }

  if (options?.includeScoreDistribution) {
    const dist = generateDistribution(results.results);
    lines.push('## Score Distribution');
    lines.push('');
    lines.push('| Range | Count |');
    lines.push('|-------|-------|');
    for (let i = 0; i < dist.counts.length; i++) {
      lines.push(
        `| ${dist.buckets[i].toFixed(1)}-${dist.buckets[i + 1].toFixed(1)} | ${dist.counts[i]} |`
      );
    }
    lines.push('');
  }

  if (options?.includeFailedCases) {
    const failed = results.results.filter((r) => !r.passed);
    if (failed.length > 0) {
      lines.push('## Failed Cases');
      lines.push('');
      for (const result of failed) {
        lines.push(`### Case: ${result.input.slice(0, 50)}...`);
        lines.push('');
        lines.push(`**Input:** ${result.input}`);
        lines.push('');
        lines.push(`**Output:** ${result.output}`);
        lines.push('');
        lines.push(`**Scores:**`);
        for (const detail of result.details) {
          const status = detail.passed ? '✓' : '✗';
          lines.push(
            `- ${status} ${detail.metric}: ${detail.score.toFixed(3)} (threshold: ${detail.threshold})`
          );
          if (detail.reason) {
            lines.push(`  - Reason: ${detail.reason}`);
          }
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate JSON report
 */
function generateJSON(
  results: BatchEvaluationResult,
  metricStats: EvaluationReport['metricStats'],
  options: ReportConfig['options']
): string {
  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalCases: results.results.length,
      passedCases: results.passedCount,
      failedCases: results.failedCount,
      passRate: results.passRate,
      averageScore: results.overallAverage,
      durationMs: results.durationMs,
    },
    metricStats,
  };

  if (options?.includeScoreDistribution) {
    report.scoreDistribution = generateDistribution(results.results);
  }

  if (options?.includeFailedCases) {
    report.failedCases = results.results
      .filter((r) => !r.passed)
      .map((r) => ({
        input: r.input,
        output: r.output,
        scores: r.scores,
        details: r.details,
      }));
  }

  return JSON.stringify(report, null, 2);
}

/**
 * Generate HTML report
 */
function generateHTML(
  results: BatchEvaluationResult,
  metricStats: EvaluationReport['metricStats'],
  options: ReportConfig['options']
): string {
  const dist = generateDistribution(results.results);
  const failed = results.results.filter((r) => !r.passed);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Evaluation Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 2rem; background: #f5f5f5; }
    h1 { color: #333; }
    .card { background: white; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
    .stat { text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; color: #2563eb; }
    .stat-label { color: #666; font-size: 0.875rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f8f8; font-weight: 600; }
    .pass { color: #16a34a; }
    .fail { color: #dc2626; }
    .bar { height: 20px; background: #2563eb; border-radius: 2px; }
    .bar-container { background: #eee; border-radius: 2px; overflow: hidden; }
  </style>
</head>
<body>
  <h1>Evaluation Report</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>

  <div class="card">
    <h2>Summary</h2>
    <div class="summary-grid">
      <div class="stat">
        <div class="stat-value">${results.results.length}</div>
        <div class="stat-label">Total Cases</div>
      </div>
      <div class="stat">
        <div class="stat-value pass">${results.passedCount}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat">
        <div class="stat-value fail">${results.failedCount}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat">
        <div class="stat-value">${(results.passRate * 100).toFixed(1)}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
      <div class="stat">
        <div class="stat-value">${results.overallAverage.toFixed(3)}</div>
        <div class="stat-label">Avg Score</div>
      </div>
    </div>
  </div>

  ${
    options?.includeMetricBreakdown
      ? `
  <div class="card">
    <h2>Metric Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Average</th>
          <th>Min</th>
          <th>Max</th>
          <th>Std Dev</th>
          <th>Pass Rate</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(metricStats)
          .map(
            ([name, stats]) => `
          <tr>
            <td>${name}</td>
            <td>${stats.average.toFixed(3)}</td>
            <td>${stats.min.toFixed(3)}</td>
            <td>${stats.max.toFixed(3)}</td>
            <td>${stats.stdDev.toFixed(3)}</td>
            <td>${(stats.passRate * 100).toFixed(1)}%</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>
  `
      : ''
  }

  ${
    options?.includeScoreDistribution
      ? `
  <div class="card">
    <h2>Score Distribution</h2>
    <table>
      <thead>
        <tr>
          <th>Range</th>
          <th>Count</th>
          <th style="width: 60%">Distribution</th>
        </tr>
      </thead>
      <tbody>
        ${dist.counts
          .map((count, i) => {
            const maxCount = Math.max(...dist.counts);
            const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return `
          <tr>
            <td>${dist.buckets[i].toFixed(1)}-${dist.buckets[i + 1].toFixed(1)}</td>
            <td>${count}</td>
            <td><div class="bar-container"><div class="bar" style="width: ${width}%"></div></div></td>
          </tr>
        `;
          })
          .join('')}
      </tbody>
    </table>
  </div>
  `
      : ''
  }

  ${
    options?.includeFailedCases && failed.length > 0
      ? `
  <div class="card">
    <h2>Failed Cases (${failed.length})</h2>
    ${failed
      .slice(0, 10)
      .map(
        (r) => `
      <div style="border: 1px solid #eee; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <p><strong>Input:</strong> ${escapeHtml(r.input)}</p>
        <p><strong>Output:</strong> ${escapeHtml(r.output.slice(0, 200))}${r.output.length > 200 ? '...' : ''}</p>
        <ul>
          ${r.details
            .map(
              (d) => `
            <li class="${d.passed ? 'pass' : 'fail'}">
              ${d.passed ? '✓' : '✗'} ${d.metric}: ${d.score.toFixed(3)} (threshold: ${d.threshold})
              ${d.reason ? `<br><small>${escapeHtml(d.reason)}</small>` : ''}
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `
      )
      .join('')}
    ${failed.length > 10 ? `<p><em>...and ${failed.length - 10} more failed cases</em></p>` : ''}
  </div>
  `
      : ''
  }
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate evaluation report
 * @param config - Report configuration
 * @returns Generated report
 * @example
 * ```typescript
 * const report = await generateReport({
 *   results: batchResults,
 *   format: 'html',
 *   outputPath: './report.html',
 * })
 * ```
 */
export async function generateReport(config: ReportConfig): Promise<EvaluationReport> {
  const { results, format, outputPath, options = {} } = config;

  // Calculate metric statistics
  const metricStats: EvaluationReport['metricStats'] = {};

  for (const result of results.results) {
    for (const detail of result.details) {
      if (!metricStats[detail.metric]) {
        metricStats[detail.metric] = {
          average: 0,
          min: Infinity,
          max: -Infinity,
          stdDev: 0,
          passRate: 0,
        };
      }

      const stat = metricStats[detail.metric];
      stat.min = Math.min(stat.min, detail.score);
      stat.max = Math.max(stat.max, detail.score);
    }
  }

  // Calculate averages and pass rates
  for (const metricName of Object.keys(metricStats)) {
    const scores = results.results.map(
      (r) => r.details.find((d) => d.metric === metricName)?.score ?? 0
    );
    const passed = results.results.filter(
      (r) => r.details.find((d) => d.metric === metricName)?.passed ?? false
    );

    metricStats[metricName].average = scores.reduce((a, b) => a + b, 0) / scores.length;
    metricStats[metricName].stdDev = stdDev(scores);
    metricStats[metricName].passRate = passed.length / results.results.length;
  }

  // Generate content
  let content: string;
  switch (format) {
    case 'html':
      content = generateHTML(results, metricStats, options);
      break;
    case 'json':
      content = generateJSON(results, metricStats, options);
      break;
    case 'markdown':
    default:
      content = generateMarkdown(results, metricStats, options);
  }

  // Save to file if path provided
  if (outputPath) {
    const fs = await import('node:fs/promises');
    await fs.writeFile(outputPath, content, 'utf-8');
  }

  return {
    content,
    path: outputPath,
    summary: {
      totalCases: results.results.length,
      passedCases: results.passedCount,
      failedCases: results.failedCount,
      passRate: results.passRate,
      averageScore: results.overallAverage,
      evaluatedAt: new Date(),
      durationMs: results.durationMs,
    },
    metricStats,
  };
}
