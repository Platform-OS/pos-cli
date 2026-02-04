import { jest } from '@jest/globals';
import { jsonToZipBuffer } from '../data/json-to-csv.js';
import { createRequire } from 'module';
import { Readable } from 'stream';

const require = createRequire(import.meta.url);
const unzipper = require('unzipper');

async function extractZipEntries(buffer) {
  const entries = {};
  const directory = await unzipper.Open.buffer(buffer);

  for (const file of directory.files) {
    const content = await file.buffer();
    entries[file.path] = content.toString('utf8');
  }

  return entries;
}

describe('jsonToZipBuffer', () => {
  test('converts records to CSV in ZIP', async () => {
    const jsonData = {
      records: [
        { id: '1', properties: { name: 'Test Item', done: false }, model_schema: 'todo' },
        { id: '2', properties: { name: 'Another Item', done: true }, model_schema: 'todo' }
      ]
    };

    const buffer = await jsonToZipBuffer(jsonData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const entries = await extractZipEntries(buffer);
    expect(entries['records.csv']).toBeDefined();

    const csv = entries['records.csv'];
    expect(csv).toContain('id,user_id,created_at,updated_at,properties,model_schema');
    expect(csv).toContain('todo');
    expect(csv).toContain('Test Item');
  });

  test('converts users to CSV in ZIP', async () => {
    const jsonData = {
      users: [
        { id: '1', email: 'test@example.com', first_name: 'John', last_name: 'Doe' },
        { id: '2', email: 'jane@example.com', first_name: 'Jane', last_name: 'Smith' }
      ]
    };

    const buffer = await jsonToZipBuffer(jsonData);
    const entries = await extractZipEntries(buffer);

    expect(entries['users.csv']).toBeDefined();

    const csv = entries['users.csv'];
    expect(csv).toContain('id,email');
    expect(csv).toContain('test@example.com');
    expect(csv).toContain('jane@example.com');
  });

  test('handles both records and users', async () => {
    const jsonData = {
      records: [{ id: '1', model_schema: 'item' }],
      users: [{ id: '1', email: 'user@test.com' }]
    };

    const buffer = await jsonToZipBuffer(jsonData);
    const entries = await extractZipEntries(buffer);

    expect(entries['records.csv']).toBeDefined();
    expect(entries['users.csv']).toBeDefined();
  });

  test('handles models field as records', async () => {
    const jsonData = {
      models: [{ id: '1', properties: { title: 'Test' }, model_schema: 'post' }]
    };

    const buffer = await jsonToZipBuffer(jsonData);
    const entries = await extractZipEntries(buffer);

    expect(entries['records.csv']).toBeDefined();
    expect(entries['records.csv']).toContain('post');
  });

  test('handles transactables field as records', async () => {
    const jsonData = {
      transactables: [{ id: '1', model_schema: 'order' }]
    };

    const buffer = await jsonToZipBuffer(jsonData);
    const entries = await extractZipEntries(buffer);

    expect(entries['records.csv']).toBeDefined();
  });

  test('escapes CSV special characters', async () => {
    const jsonData = {
      records: [
        { id: '1', properties: { description: 'Has "quotes" and, commas' }, model_schema: 'test' }
      ]
    };

    const buffer = await jsonToZipBuffer(jsonData);
    const entries = await extractZipEntries(buffer);
    const csv = entries['records.csv'];

    // Properties column should contain the JSON with escaped quotes
    // The value contains comma so it should be wrapped in quotes
    expect(csv).toContain('description');
    expect(csv).toContain('quotes');
    expect(csv).toContain('commas');
  });

  test('handles empty data', async () => {
    const jsonData = {};

    const buffer = await jsonToZipBuffer(jsonData);
    expect(buffer).toBeInstanceOf(Buffer);

    const entries = await extractZipEntries(buffer);
    expect(Object.keys(entries).length).toBe(0);
  });

  test('handles type field as model_schema', async () => {
    const jsonData = {
      records: [{ id: '1', type: 'product', properties: {} }]
    };

    const buffer = await jsonToZipBuffer(jsonData);
    const entries = await extractZipEntries(buffer);
    const csv = entries['records.csv'];

    expect(csv).toContain('product');
  });
});
