import { expect } from 'vitest';

export interface Interaction {
  input: any;
  output: any;
  timestamp: number;
}

class TestTracer {
  private traces = new Map<string, Interaction[]>();

  log(input: any, output: any) {
    // Vitest exposes current test name via expect.getState()
    const testName = expect.getState().currentTestName || 'unknown';
    
    if (!this.traces.has(testName)) {
      this.traces.set(testName, []);
    }
    
    this.traces.get(testName)?.push({
      input,
      output,
      timestamp: Date.now()
    });
  }

  get(testName: string): Interaction[] {
    return this.traces.get(testName) || [];
  }
  
  getAll() {
    return this.traces;
  }
}

export const tracer = new TestTracer();
