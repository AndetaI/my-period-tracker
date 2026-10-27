import { encryptBackup } from '@/services/backupEncryptionService';
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

export async function exportEncryptedBackup(
  password: string
): Promise<boolean> {
  if (password.length < 12) {
    throw new Error(
      'Backup password must contain at least 12 characters.'
    );
  }

  const sharingAvailable = await Sharing.isAvailableAsync();

  if (!sharingAvailable) {
    throw new Error(
      'File sharing is not available on this device.'
    );
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const temporaryName =
    `period-tracker-temp-${timestamp}.db`;

  const encryptedName =
    `period-tracker-backup-${timestamp}.ptbackup`;

  const backupDb = await SQLite.openDatabaseAsync(
    temporaryName,
    undefined,
    Paths.cache.uri
  );

  const temporaryFile = new File(
    Paths.cache,
    temporaryName
  );

  const encryptedFile = new File(
    Paths.cache,
    encryptedName
  );

  try {
    // 1. Create a consistent SQLite snapshot.
    try {
      await SQLite.backupDatabaseAsync({
        sourceDatabase: db,
        destDatabase: backupDb,
      });

      const integrity = await backupDb.getFirstAsync<{
        integrity_check: string;
      }>('PRAGMA integrity_check;');

      if (integrity?.integrity_check !== 'ok') {
        throw new Error(
          'Backup integrity check failed.'
        );
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

    if (!temporaryFile.exists || temporaryFile.size === 0) {
      throw new Error(
        'Temporary SQLite backup was not created.'
      );
    }

    // 2. Read the database as binary data.
console.log('[Backup] Reading SQLite snapshot');

const databaseBytes = await temporaryFile.bytes();

console.log('[Backup] SQLite bytes:', databaseBytes.length);

if (databaseBytes.length === 0) {
  throw new Error('SQLite snapshot is empty.');
}

console.log('[Backup] Starting encryption');

const encryptedBytes = encryptBackup(
  databaseBytes,
  password
);

console.log('[Backup] Encrypted bytes:', encryptedBytes.length);

console.log('[Backup] Creating encrypted file');

encryptedFile.create({ overwrite: true });
encryptedFile.write(encryptedBytes);

const fileInfo = await LegacyFileSystem.getInfoAsync(
  encryptedFile.uri
);

console.log('[Share] Expected size:', encryptedBytes.length);
console.log('[Share] Actual file info:', fileInfo);

if (
  !fileInfo.exists ||
  fileInfo.size !== encryptedBytes.length
) {
  throw new Error(
    'Encrypted backup file is missing or incomplete.'
  );
}
    // 5. Open Android's share sheet.
    await Sharing.shareAsync(encryptedFile.uri, {
      dialogTitle: 'Export Encrypted Period Tracker Backup',
      mimeType: 'application/octet-stream',
    });

    // This confirms that sharing was opened,
    // not that the user completed saving the file.
    return true;
  } finally {
    // Remove the unencrypted temporary snapshot.
    try {
      if (temporaryFile.exists) {
        temporaryFile.delete();
      }
    } catch (error) {
      console.warn(
        'Could not delete temporary SQLite backup:',
        error
      );
    }
  }
}

export async function saveEncryptedBackupToDevice(
  password: string
): Promise<boolean> {
  if (password.length < 12) {
    throw new Error(
      'Backup password must contain at least 12 characters.'
    );
  }

  // Request the destination before creating sensitive files.
  const permission =
    await LegacyFileSystem.StorageAccessFramework
      .requestDirectoryPermissionsAsync();

  if (!permission.granted) {
    return false;
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const temporaryName = `period-tracker-temp-${timestamp}.db`;
  const encryptedName =
    `period-tracker-backup-${timestamp}.ptbackup`;

  const backupDb = await SQLite.openDatabaseAsync(
    temporaryName,
    undefined,
    Paths.cache.uri
  );

  const temporaryFile = new File(Paths.cache, temporaryName);
  const encryptedFile = new File(Paths.cache, encryptedName);

  try {
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

    if (!temporaryFile.exists || temporaryFile.size === 0) {
      throw new Error('Temporary backup was not created.');
    }

    const databaseBytes = await temporaryFile.bytes();
    const encryptedBytes = encryptBackup(databaseBytes, password);

    encryptedFile.create({ overwrite: true });

    encryptedFile.write(encryptedBytes);

    const encryptedInfo =
      await LegacyFileSystem.getInfoAsync(encryptedFile.uri);

    console.log('Encrypted backup info:', encryptedInfo);
    console.log('Expected encrypted bytes:', encryptedBytes.length);

    if (!encryptedInfo.exists) {
      throw new Error('Encrypted backup file does not exist.');
    }

    if (
      encryptedInfo.size === undefined ||
      encryptedInfo.size === 0
    ) {
      throw new Error('Encrypted backup file is empty.');
    }

    if (encryptedInfo.size !== encryptedBytes.length) {
      throw new Error('Encrypted backup file size mismatch.');
    }
    
let destinationUri: string;

try {
  destinationUri =
    await LegacyFileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      encryptedName,
      'application/octet-stream'
    );
} catch (error) {
  console.error('Backup destination error:', error);

  throw new Error(
    'The selected folder does not allow saving files. ' +
    'Please choose a writable folder in your phone’s internal storage, ' +
    'such as Downloads.'
  );
}


    const encryptedBase64 =
      await LegacyFileSystem.readAsStringAsync(
        encryptedFile.uri,
        {
          encoding: LegacyFileSystem.EncodingType.Base64,
        }
      );

    await LegacyFileSystem.writeAsStringAsync(
      destinationUri,
      encryptedBase64,
      {
        encoding: LegacyFileSystem.EncodingType.Base64,
      }
    );

    return true;
  } finally {
    if (temporaryFile.exists) {
      try {
        temporaryFile.delete();
      } catch (error) {
        console.warn('Temporary backup cleanup failed:', error);
      }
    }
  }
}
