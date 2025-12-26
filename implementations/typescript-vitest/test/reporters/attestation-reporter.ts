import { Reporter, File, Suite, Task } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { tracer } from '../modules/tracer';

export default class AttestationReporter implements Reporter {
  private startTime: number = 0;

  onInit() {
    this.startTime = Date.now();
    tracer.clear(); // Clear old traces
  }

  onFinished(files: File[]) {
    const endTime = Date.now();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Create timestamped directory
    const reportsRoot = path.resolve(process.cwd(), '../../reports');
    const reportDir = path.join(reportsRoot, timestamp);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // Git Metadata
    const gitInfo = this.getGitInfo();

    // Generate Content
    const markdown = this.generateMarkdown(files, gitInfo, duration);
    const htmlLight = this.generateHtml(files, gitInfo, duration, false);
    const htmlFull = this.generateHtml(files, gitInfo, duration, true);

    // Write Files
    fs.writeFileSync(path.join(reportDir, 'attestation.md'), markdown);
    fs.writeFileSync(path.join(reportDir, 'attestation-light.html'), htmlLight);
    fs.writeFileSync(path.join(reportDir, 'attestation-full.html'), htmlFull);

    console.log(`
[Attestation] Reports generated in: ${reportDir}`);
    console.log(`  - Light: attestation-light.html`);
    console.log(`  - Full:  attestation-full.html`);
  }

  private getGitInfo() {
    try {
      const hash = execSync('git rev-parse --short HEAD').toString().trim();
      const dirtyFiles = execSync('git status --porcelain').toString().trim();
      return { hash, dirtyFiles };
    } catch (e) {
      return { hash: 'Unknown (Not a git repo?)', dirtyFiles: '' };
    }
  }

  private generateMarkdown(files: File[], gitInfo: { hash: string, dirtyFiles: string }, duration: string): string {
    let md = `# Pricing Engine: Quality Assurance Attestation\n\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n`;
    md += `**Git Hash:** 
${gitInfo.hash}

`;
    if (gitInfo.dirtyFiles) {
      md += `
**⚠️ Uncommitted Changes:**

${gitInfo.dirtyFiles}

`;
    }
    md += `
## 1. Executive Summary

`;
    md += `| Area | Passed | Failed | Status |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;

    let totalPass = 0;
    let totalFail = 0;

    files.forEach(file => {
      file.tasks.forEach(task => {
        if (task.type === 'suite') {
          const stats = this.getSuiteStats(task);
          totalPass += stats.passed;
          totalFail += stats.failed;
          const status = stats.failed === 0 ? '✅ PASS' : '❌ FAIL';
          md += `| ${task.name} | ${stats.passed} | ${stats.failed} | ${status} |\n`;
        }
      });
    });

    md += `
**Total Scenarios:** ${totalPass + totalFail} | **Pass Rate:** ${((totalPass / (totalPass + totalFail)) * 100).toFixed(1)}%\n`;
    md += `
## 2. Detailed Audit Log

`;

    files.forEach(file => {
      file.tasks.forEach(task => {
        md += this.renderTaskMd(task, 3);
      });
    });

    return md;
  }

  private generateHtml(files: File[], gitInfo: { hash: string, dirtyFiles: string }, duration: string, includeTraces: boolean): string {
    let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>QA Attestation Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { border-bottom: 2px solid #eaeaea; padding-bottom: 10px; }
  .metadata { background: #f6f8fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; border: 1px solid #e1e4e8; }
  .warning { color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 10px; border: 1px solid #ffeeba; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
  th, td { text-align: left; padding: 12px; border-bottom: 1px solid #eaeaea; }
  th { background-color: #f6f8fa; font-weight: 600; }
  .status-pass { color: #28a745; font-weight: bold; }
  .status-fail { color: #cb2431; font-weight: bold; }
  .suite-header { background-color: #f1f8ff; padding: 10px; margin-top: 20px; border-radius: 4px; font-weight: 600; }
  .nested-suite { margin-left: 20px; border-left: 2px solid #eaeaea; padding-left: 10px; }
</style>
</head>
<body>
  <h1>Pricing Engine: QA Attestation</h1>
  
  <div class="metadata">
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    ${includeTraces ? `<p><strong>Duration:</strong> ${duration}s</p>` : ''}
    <p><strong>Git Hash:</strong> <code>${gitInfo.hash}</code></p>
    ${gitInfo.dirtyFiles ? `<div class="warning"><strong>⚠️ Uncommitted Changes:</strong><pre>${gitInfo.dirtyFiles}</pre></div>` : ''}
  </div>

  <h2>1. Executive Summary</h2>
  <table>
    <tr><th>Area</th><th>Passed</th><th>Failed</th><th>Status</th></tr>
`;

    files.forEach(file => {
      file.tasks.forEach(task => {
        if (task.type === 'suite') {
          const stats = this.getSuiteStats(task);
          const statusClass = stats.failed === 0 ? 'status-pass' : 'status-fail';
          const statusText = stats.failed === 0 ? '✅ PASS' : '❌ FAIL';
          html += `<tr><td>${task.name}</td><td>${stats.passed}</td><td>${stats.failed}</td><td class="${statusClass}">${statusText}</td></tr>`;
        }
      });
    });

    html += `</table>
    <h2>2. Detailed Audit Log</h2>
    <div class="audit-log">
`;

    files.forEach(file => {
      file.tasks.forEach(task => {
        html += this.renderTaskHtml(task, 0, includeTraces);
      });
    });

    html += `</div></body></html>`;
    return html;
  }

  private getSuiteStats(suite: Suite): { passed: number; failed: number } {
    let passed = 0;
    let failed = 0;
    suite.tasks.forEach(task => {
      if (task.type === 'test') {
        if (task.result?.state === 'pass') passed++;
        else failed++;
      } else if (task.type === 'suite') {
        const nested = this.getSuiteStats(task);
        passed += nested.passed;
        failed += nested.failed;
      }
    });
    return { passed, failed };
  }

  private renderTaskMd(task: Task, level: number): string {
    const indent = '#'.repeat(level);
    let output = '';

    if (task.type === 'suite') {
      output += `
${indent} ${task.name}

`;
      const hasDirectTests = task.tasks.some(t => t.type === 'test');
      if (hasDirectTests) {
         output += `| Scenario | Result |\n`;
         output += `| :--- | :--- |\n`;
      }
      task.tasks.forEach(subTask => output += this.renderTaskMd(subTask, level + 1));
    } else if (task.type === 'test') {
      const status = task.result?.state === 'pass' ? '✅ PASS' : '❌ FAIL';
      output += `| ${task.name} | ${status} |\n`;
    }
    return output;
  }

  private renderTaskHtml(task: Task, level: number, includeTraces: boolean): string {
    let output = '';
    if (task.type === 'suite') {
      const margin = level * 20;
      output += `<div style="margin-left: ${margin}px">
`;
      output += `<h3 class="suite-header">${task.name}</h3>
`;
      
      const hasDirectTests = task.tasks.some(t => t.type === 'test');
      if (hasDirectTests) {
         const durationHeader = includeTraces ? '<th style="width: 10%">Duration</th>' : '';
         output += `<table><tr><th style="width: 60%">Scenario</th><th style="width: 10%">Result</th>${durationHeader}</tr>`;
         task.tasks.forEach(subTask => {
             if (subTask.type === 'test') {
                 const status = subTask.result?.state === 'pass' ? '✅ PASS' : '❌ FAIL';
                 const statusClass = subTask.result?.state === 'pass' ? 'status-pass' : 'status-fail';
                 
                 
                 // Fetch Interactions
                 let details = '';
                 if (includeTraces) {
                    const interactions = tracer.get(getFullTestName(subTask));
                    if (interactions.length > 0) {
                      details = `<details><summary>View Input/Output (${interactions.length} interactions)</summary>`;
                      interactions.forEach((interaction, idx) => {
                        details += `
                          <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                            <div style="font-size: 0.8em; color: #999; margin-bottom: 5px;">Interaction #${idx + 1}</div>
                            <div class="io-block">
                              <div class="io-section">
                                <div class="io-label">Input</div>
                                <pre>${JSON.stringify(interaction.input, null, 2)}</pre>
                              </div>
                              <div class="io-section">
                                <div class="io-label">Output</div>
                                <pre>${JSON.stringify(interaction.output, null, 2)}</pre>
                              </div>
                            </div>
                          </div>`;
                      });
                      details += `</details>`;
                    }
                 }

                 const durationCell = includeTraces ? `<td>${subTask.result?.duration ? `${subTask.result.duration}ms` : '-'}</td>` : '';
                 output += `<tr><td>${subTask.name}${details}</td><td class="${statusClass}">${status}</td>${durationCell}</tr>`;
             }
         });
         output += `</table>`;
      }
      
      task.tasks.forEach(subTask => {
          if (subTask.type === 'suite') {
              output += this.renderTaskHtml(subTask, level + 1, includeTraces);
          }
      });
      output += `</div>`;
    }
    return output;
  }
}

function getFullTestName(task: Task): string {
  let name = task.name;
  let parent = task.suite;
  while (parent && parent.name) {
    name = `${parent.name} > ${name}`;
    parent = parent.suite;
  }
  return name;
}
