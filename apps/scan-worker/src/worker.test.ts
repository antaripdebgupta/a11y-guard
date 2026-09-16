import { describe, it, expect } from 'vitest';
import { setupScanWorker } from './worker.js';

describe('Scan Worker', () => {
  it('instantiates worker instance without throwing', () => {
    const { worker, connection } = setupScanWorker();
    expect(worker).toBeDefined();
    expect(connection).toBeDefined();
    // Clean up connections
    void worker.close();
    void connection.disconnect();
  });
});
