
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';

import { db } from '@/db/database';
import * as LegacyFileSystem from 'expo-file-system/legacy';


export async function saveBackupToDevice(): Promise<boolean> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const fileName = `period-tracker-backup-${timestamp}.db`;

  const backupDb = await SQLite.openDatabaseAsync(
    fileName,
    undefined,
    Paths.cache.uri
  );

  try {
    await SQLite.backupDatabaseAsync({
      sourceDatabase: db,
      destDatabase: backupDb,
    });

    const integrity = await backupDb.getFirstAsync<{
      integrity_check: string;
    }>('PRAGMA integrity_check;');

    if (integrity?.integrity_check !== 'ok') {
      throw new Error('Backup integrity check failed.');
    }

    const foreignKeyErrors = await backupDb.getAllAsync(
      'PRAGMA foreign_key_check;'
    );

    if (foreignKeyErrors.length > 0) {
      throw new Error('Backup contains foreign key errors.');
    }
  } finally {
    await backupDb.closeAsync();
  }

  const backupFile = new File(Paths.cache, fileName);

  if (!backupFile.exists || backupFile.size === 0) {
    throw new Error('Backup file was not created.');
  }

  // Ask the user to select a folder on the phone.
  const permission =
    await LegacyFileSystem.StorageAccessFramework
      .requestDirectoryPermissionsAsync();

  if (!permission.granted) {
    return false;
  }

  // Create the backup file inside the selected folder.
  const destinationUri =
    await LegacyFileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      fileName,
      'application/octet-stream'
    );

  // Read the temporary SQLite backup and write it to
  // the selected destination without changing its bytes.
  const backupBase64 =
    await LegacyFileSystem.readAsStringAsync(
      backupFile.uri,
      {
        encoding: LegacyFileSystem.EncodingType.Base64,
      }
    );

  await LegacyFileSystem.writeAsStringAsync(
    destinationUri,
    backupBase64,
    {
      encoding: LegacyFileSystem.EncodingType.Base64,
    }
  );

  return true;
}



export async function exportBackup(): Promise<boolean> {
  const available = await Sharing.isAvailableAsync();

  if (!available) {
    throw new Error(
      'File sharing is not available on this device.'
    );
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const fileName = `period-tracker-backup-${timestamp}.db`;

  // Create a separate temporary database.
  const backupDb = await SQLite.openDatabaseAsync(
    fileName,
    undefined,
    Paths.cache.uri
  );

  try {
    // Copy the live database into a consistent snapshot.
    await SQLite.backupDatabaseAsync({
      sourceDatabase: db,
      destDatabase: backupDb,
    });

    const integrity = await backupDb.getFirstAsync<{
      integrity_check: string;
    }>('PRAGMA integrity_check;');

    if (integrity?.integrity_check !== 'ok') {
      throw new Error('Backup integrity check failed.');
    }

    const foreignKeyErrors = await backupDb.getAllAsync(
      'PRAGMA foreign_key_check;'
    );

    if (foreignKeyErrors.length > 0) {
      throw new Error(
        'Backup contains foreign key errors.'
      );
    }
  } finally {
    await backupDb.closeAsync();
  }

  const backupFile = new File(Paths.cache, fileName);

  if (!backupFile.exists || backupFile.size === 0) {
    throw new Error('Backup file was not created.');
  }

  // Let the user save or share the backup.
  await Sharing.shareAsync(backupFile.uri, {
    dialogTitle: 'Export Period Tracker Backup',
    mimeType: 'application/octet-stream',
    UTI: 'public.database',
  });

  // The share sheet does not reliably confirm that the
  // user actually saved the file.
  return true;
}
