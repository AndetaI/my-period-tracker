import { decryptBackup } from '@/services/backupEncryptionService';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
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
  const recoveryName = `pre-restore-${Date.now()}.db`;

  // Open a separate database for the recovery copy.
  const recoveryDb = await SQLite.openDatabaseAsync(
    recoveryName
  );

  let recoveryReady = false;

  try {
    // STEP 1: Back up the current database.
    await SQLite.backupDatabaseAsync({
      sourceDatabase: db,
      destDatabase: recoveryDb,
    });

    // STEP 2: Verify the recovery database.
    const recoveryIntegrity =
      await recoveryDb.getFirstAsync<{
        integrity_check: string;
      }>('PRAGMA integrity_check;');

    const recoveryForeignKeys =
      await recoveryDb.getAllAsync(
        'PRAGMA foreign_key_check;'
      );

    if (
      recoveryIntegrity?.integrity_check !== 'ok' ||
      recoveryForeignKeys.length > 0
    ) {
      throw new Error(
        'Could not create a valid recovery backup.'
      );
    }

    recoveryReady = true;

    // STEP 3: Restore the selected backup.
    try {
      await SQLite.backupDatabaseAsync({
        sourceDatabase: selected.database,
        destDatabase: db,
      });

      // STEP 4: Verify the restored database.
      const restoredIntegrity =
        await db.getFirstAsync<{
          integrity_check: string;
        }>('PRAGMA integrity_check;');

      const restoredForeignKeys =
        await db.getAllAsync(
          'PRAGMA foreign_key_check;'
        );

      if (
        restoredIntegrity?.integrity_check !== 'ok' ||
        restoredForeignKeys.length > 0
      ) {
        throw new Error(
          'Restored database failed verification.'
        );
      }

      console.log('Database restored successfully.');

      return recoveryName;
    } catch (restoreError) {
      // STEP 5: Attempt to recover the original database.
      console.error(
        'Restore failed. Attempting rollback:',
        restoreError
      );

      if (recoveryReady) {
        try {
          await SQLite.backupDatabaseAsync({
            sourceDatabase: recoveryDb,
            destDatabase: db,
          });

          const rollbackIntegrity =
            await db.getFirstAsync<{
              integrity_check: string;
            }>('PRAGMA integrity_check;');

          const rollbackForeignKeys =
            await db.getAllAsync(
              'PRAGMA foreign_key_check;'
            );

          if (
            rollbackIntegrity?.integrity_check !== 'ok' ||
            rollbackForeignKeys.length > 0
          ) {
            throw new Error(
              'Rollback verification failed.'
            );
          }

          console.log(
            'Original database recovered successfully.'
          );

          throw new Error(
            'Restore failed, but your previous data ' +
            'was recovered successfully.'
          );
        } catch (rollbackError) {
          // Distinguish a successful rollback from
          // an actual rollback failure.
          if (
            rollbackError instanceof Error &&
            rollbackError.message.includes(
              'previous data was recovered successfully'
            )
          ) {
            throw rollbackError;
          }

          console.error(
            'Automatic rollback failed:',
            rollbackError
          );

          throw new Error(
            'Restore and automatic rollback failed. ' +
            `Recovery database: ${recoveryName}. ` +
            'Do not uninstall the app or clear its data.'
          );
        }
      }

      throw restoreError;
    }
  } finally {
    await recoveryDb.closeAsync();
  }
}

export async function selectAndDecryptBackup(
  password: string
): Promise<SelectedBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];

  if (!asset.name.toLowerCase().endsWith('.ptbackup')) {
    throw new Error(
      'Please select an encrypted .ptbackup file.'
    );
  }

  const encryptedFile = new File(asset.uri);
  const encryptedBytes = await encryptedFile.bytes();

  // Wrong passwords and modified files are rejected here.
  const databaseBytes = decryptBackup(encryptedBytes, password);

  const temporaryName =
    `decrypted-restore-${Date.now()}.db`;

  const temporaryFile = new File(Paths.cache, temporaryName);

  let candidate: SQLite.SQLiteDatabase | null = null;

  try {
    temporaryFile.create({ overwrite: true });
    temporaryFile.write(databaseBytes);

    candidate = await SQLite.openDatabaseAsync(
      temporaryName,
      undefined,
      Paths.cache.uri
    );

    const integrity = await candidate.getFirstAsync<{
      integrity_check: string;
    }>('PRAGMA integrity_check;');

    if (integrity?.integrity_check !== 'ok') {
      throw new Error('Decrypted database failed integrity check.');
    }

    const foreignKeyErrors = await candidate.getAllAsync(
      'PRAGMA foreign_key_check;'
    );

    if (foreignKeyErrors.length > 0) {
      throw new Error('Decrypted database has foreign key errors.');
    }

    const tables = await candidate.getAllAsync<{
      name: string;
    }>(
      "SELECT name FROM sqlite_master WHERE type = 'table';"
    );

    const tableNames = new Set(tables.map((table) => table.name));

    for (const requiredTable of REQUIRED_TABLES) {
      if (!tableNames.has(requiredTable)) {
        throw new Error(
          `Backup is missing required table: ${requiredTable}`
        );
      }
    }

    const migration = await candidate.getFirstAsync<{
      version: number;
    }>(
      'SELECT MAX(version) AS version FROM schema_migrations;'
    );

    if (migration?.version !== 1) {
      throw new Error('Unsupported backup database version.');
    }

    const settings = await candidate.getFirstAsync(
      'SELECT * FROM user_settings LIMIT 1;'
    );

    if (!settings) {
      throw new Error('Backup does not contain user settings.');
    }

    const selectedDatabase = candidate;

    return {
      name: asset.name,
      database: selectedDatabase,
      close: async () => {
        try {
          await selectedDatabase.closeAsync();
        } finally {
          if (temporaryFile.exists) {
            temporaryFile.delete();
          }
        }
      },
    };
  } catch (error) {
    if (candidate) {
      await candidate.closeAsync();
    }

    if (temporaryFile.exists) {
      temporaryFile.delete();
    }

    throw error;
  }
}
