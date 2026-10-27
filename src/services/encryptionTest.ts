
import {
    decryptBackup,
    encryptBackup,
} from './backupEncryptionService';

export function testBackupEncryption(): void {
  const password = 'TestPassword123!';

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const original = encoder.encode('My Period Tracker test data');

  try {
    // Test 1: Encrypt and decrypt
    const encrypted = encryptBackup(original, password);
    const decrypted = decryptBackup(encrypted, password);

    const restoredText = decoder.decode(decrypted);

    console.log(
      'Test 1 - Encryption/decryption:',
      restoredText === 'My Period Tracker test data'
        ? 'PASSED'
        : 'FAILED'
    );

    // Test 2: Incorrect password
    try {
      decryptBackup(encrypted, 'WrongPassword123!');
      console.log('Test 2 - Wrong password: FAILED');
    } catch {
      console.log('Test 2 - Wrong password: PASSED');
    }

    // Test 3: Detect modified encrypted data
    const modified = new Uint8Array(encrypted);
    modified[modified.length - 1] ^= 1;

    try {
      decryptBackup(modified, password);
      console.log('Test 3 - Tamper detection: FAILED');
    } catch {
      console.log('Test 3 - Tamper detection: PASSED');
    }
  } catch (error) {
    console.error('Encryption test error:', error);
  }
}
