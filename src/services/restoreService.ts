
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import { db } from '@/db/database';
import * as LegacyFileSystem from 'expo-file-system/legacy';
const REQUIRED_TABLES = [
  'cycles',
  'periods',
  'daily_logs',
  'symptoms',
  'daily_log_symptoms',
  'ovulation_estimates',
  'user_settings',
  'schema_migrations',
];

export interface SelectedBackup {
  name: string;
  database: SQLite.SQLiteDatabase;
  close: () => Promise<void>;
}

// --------------------------------------------------
// SELECT AND VALIDATE BACKUP
// --------------------------------------------------

export async function selectAndValidateBackup():
  Promise<SelectedBackup | null> {

  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];

  if (!asset.name.toLowerCase().endsWith('.db')) {
    throw new Error(
      'Please select a .db backup file.'
    );
  }

  if (!asset.uri.startsWith('file://')) {
    throw new Error(
      'The selected file is not available locally.'
    );
  }

const selectedFile = new File(asset.uri);

console.log('Selected URI:', asset.uri);
console.log('Selected name:', asset.name);

const fileInfo = await LegacyFileSystem.getInfoAsync(asset.uri);

console.log('Selected URI:', asset.uri);
console.log('Backup file information:', fileInfo);

if (!fileInfo.exists) {
  throw new Error(
    'The selected backup could not be accessed.'
  );
}

if (
  'size' in fileInfo &&
  typeof fileInfo.size === 'number' &&
  fileInfo.size === 0
) {
  throw new Error(
    'The selected backup file is empty.'
  );
}


  console.log('Backup URI:', selectedFile.uri);
  console.log('Backup name:', selectedFile.name);

  const parentDirectory = selectedFile.parentDirectory;

  let candidate: SQLite.SQLiteDatabase | null = null;

  try {
    candidate = await SQLite.openDatabaseAsync(
      selectedFile.name,
      undefined,
      parentDirectory.uri
    );

    // Check database integrity.
    const integrity = await candidate.getFirstAsync<{
      integrity_check: string;
    }>('PRAGMA integrity_check;');

    if (integrity?.integrity_check !== 'ok') {
      throw new Error(
        'The backup database is damaged.'
      );
    }

    // Verify expected tables.
    const tables = await candidate.getAllAsync<{
      name: string;
    }>(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table';
    `);

    const tableNames = new Set(
      tables.map(table => table.name)
    );

    for (const table of REQUIRED_TABLES) {
      if (!tableNames.has(table)) {
        throw new Error(
          `Incompatible backup: missing table ${table}.`
        );
      }
    }

    // Verify schema version.
    const version = await candidate.getFirstAsync<{
      version: number | null;
    }>(`
      SELECT MAX(version) AS version
      FROM schema_migrations;
    `);

    if (version?.version !== 1) {
      throw new Error(
        'Unsupported backup database version.'
      );
    }

    // Check foreign key relationships.
    const foreignKeyErrors = await candidate.getAllAsync(
      'PRAGMA foreign_key_check;'
    );

    if (foreignKeyErrors.length > 0) {
      throw new Error(
        'The backup contains invalid relationships.'
      );
    }

    // Verify settings.
    const settings = await candidate.getFirstAsync<{
      id: number;
    }>(`
      SELECT id
      FROM user_settings
      WHERE id = 1;
    `);

    if (!settings) {
      throw new Error(
        'The backup is missing user settings.'
      );
    }

    const validatedDatabase = candidate;

    return {
      name: asset.name,
      database: validatedDatabase,

      close: async () => {
        await validatedDatabase.closeAsync();
      },
    };
  } catch (error) {
    if (candidate) {
      await candidate.closeAsync();
    }

    throw error;
  }
}

// --------------------------------------------------
// APPLY BACKUP
// --------------------------------------------------

export async function applyBackup(
  selected: SelectedBackup
): Promise<string> {

  const recoveryName =
    `pre-restore-${Date.now()}.db`;

  // Create a recovery database using the same
  // SQLite-managed directory as the main database.
  const recoveryDb = await SQLite.openDatabaseAsync(
    recoveryName
  );

  try {
    await SQLite.backupDatabaseAsync({
      sourceDatabase: db,
      destDatabase: recoveryDb,
    });

    const check = await recoveryDb.getFirstAsync<{
      integrity_check: string;
    }>('PRAGMA integrity_check;');

    if (check?.integrity_check !== 'ok') {
      throw new Error(
        'Could not verify the recovery copy.'
      );
    }
  } finally {
    await recoveryDb.closeAsync();
  }

  // Restore the selected backup.
  await SQLite.backupDatabaseAsync({
    sourceDatabase: selected.database,
    destDatabase: db,
  });

  // Verify the restored database.
  const integrity = await db.getFirstAsync<{
    integrity_check: string;
  }>('PRAGMA integrity_check;');

  const foreignKeyErrors = await db.getAllAsync(
    'PRAGMA foreign_key_check;'
  );

  if (
    integrity?.integrity_check !== 'ok' ||
    foreignKeyErrors.length > 0
  ) {
    throw new Error(
      'Restore verification failed. ' +
      'A recovery database was created before restoring.'
    );
  }

  return recoveryName;
}
