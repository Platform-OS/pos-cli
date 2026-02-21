// Convert JSON import format to CSV files for ZIP import
import { ZipFile } from 'yazl';

// CSV column definitions based on platformOS format
const RECORDS_COLUMNS = ['id', 'user_id', 'created_at', 'updated_at', 'properties', 'model_schema'];
const USERS_COLUMNS = ['id', 'email', 'encrypted_password', 'created_at', 'updated_at', 'name', 'authentication_token', 'slug', 'time_zone', 'first_name', 'middle_name', 'last_name', 'external_id', 'properties'];

function escapeCSVValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  // Convert objects to JSON strings
  if (typeof value === 'object') {
    value = JSON.stringify(value);
  } else {
    value = String(value);
  }

  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }

  return value;
}

function recordToCSVRow(record, columns) {
  return columns.map(col => {
    if (col === 'properties') {
      // Properties should be JSON object, ensure it's stringified
      const props = record.properties || record.customizations || {};
      return escapeCSVValue(props);
    }
    if (col === 'model_schema') {
      // model_schema can be in different fields
      return escapeCSVValue(record.model_schema || record.table || record.type || '');
    }
    return escapeCSVValue(record[col]);
  }).join(',');
}

function userToCSVRow(user, columns) {
  return columns.map(col => {
    if (col === 'properties') {
      const props = user.properties || {};
      return escapeCSVValue(props);
    }
    return escapeCSVValue(user[col]);
  }).join(',');
}

function generateRecordsCSV(records) {
  if (!records || records.length === 0) return null;

  const header = RECORDS_COLUMNS.join(',');
  const rows = records.map(r => recordToCSVRow(r, RECORDS_COLUMNS));

  return header + '\n' + rows.join('\n');
}

function generateUsersCSV(users) {
  if (!users || users.length === 0) return null;

  const header = USERS_COLUMNS.join(',');
  const rows = users.map(u => userToCSVRow(u, USERS_COLUMNS));

  return header + '\n' + rows.join('\n');
}

/**
 * Convert JSON data to ZIP buffer containing CSV files
 * @param {Object} jsonData - Data in platformOS JSON import format
 * @returns {Promise<Buffer>} - ZIP file as buffer
 */
export async function jsonToZipBuffer(jsonData) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const zipFile = new ZipFile();

    zipFile.outputStream.on('data', chunk => chunks.push(chunk));
    zipFile.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    zipFile.outputStream.on('error', reject);

    // Handle records (can be in 'records', 'models', or 'transactables')
    const records = jsonData.records || jsonData.models || jsonData.transactables || [];
    const recordsCSV = generateRecordsCSV(records);
    if (recordsCSV) {
      zipFile.addBuffer(Buffer.from(recordsCSV, 'utf8'), 'records.csv', { compress: true });
    }

    // Handle users
    const users = jsonData.users || [];
    const usersCSV = generateUsersCSV(users);
    if (usersCSV) {
      zipFile.addBuffer(Buffer.from(usersCSV, 'utf8'), 'users.csv', { compress: true });
    }

    zipFile.end();
  });
}

export default jsonToZipBuffer;
