import { Buffer } from '@craftzdog/react-native-buffer';
import {
    createCipheriv,
    createDecipheriv,
    pbkdf2Sync,
    randomBytes,
} from 'react-native-quick-crypto';

const MAGIC = 'PTBACKUP';
const VERSION = 1;
const ITERATIONS = 600_000;

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

function deriveKey(password: string, salt: Buffer): Buffer {
  return Buffer.from(
    pbkdf2Sync(
      password,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      'sha256'
    )
  );
}


export function encryptBackup(
  databaseBytes: Uint8Array,
  password: string
): Uint8Array {
  if (password.length < 12) {
    throw new Error(
      'Backup password must contain at least 12 characters.'
    );
  }

  const salt = Buffer.from(randomBytes(SALT_LENGTH));
  const iv = Buffer.from(randomBytes(IV_LENGTH));
  const key = deriveKey(password, salt);

  const header = Buffer.alloc(9);
  Buffer.from(MAGIC, 'ascii').copy(header, 0);
  header.writeUInt8(VERSION, 8);

  const metadata = Buffer.concat([header, salt, iv]);

  const cipher = createCipheriv('aes-256-gcm', key, iv);

  // Authenticate the header, salt and IV.
  cipher.setAAD(metadata);

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(databaseBytes)),
    cipher.final(),
  ]);

  const tag = Buffer.from(cipher.getAuthTag());

  return Buffer.concat([
    metadata,
    tag,
    encrypted,
  ]);
}

export function decryptBackup(
  encryptedBytes: Uint8Array,
  password: string
): Uint8Array {
  const bytes = Buffer.from(encryptedBytes);

  const metadataLength =
    9 + SALT_LENGTH + IV_LENGTH;

  const minimumLength = metadataLength + TAG_LENGTH;

  if (bytes.length < minimumLength) {
    throw new Error('Invalid encrypted backup file.');
  }

  const magic = Buffer.from(
    bytes.subarray(0, 8)
  ).toString('ascii');

  const version = bytes.readUInt8(8);

  if (magic !== MAGIC) {
    throw new Error(
      'This is not a Period Tracker encrypted backup.'
    );
  }

  if (version !== VERSION) {
    throw new Error(
      'Unsupported backup format version.'
    );
  }

  let offset = 9;

  const salt = Buffer.from(
    bytes.subarray(offset, offset + SALT_LENGTH)
  );
  offset += SALT_LENGTH;

  const iv = Buffer.from(
    bytes.subarray(offset, offset + IV_LENGTH)
  );
  offset += IV_LENGTH;

  const metadata = Buffer.from(
    bytes.subarray(0, metadataLength)
  );

  const tag = Buffer.from(
    bytes.subarray(metadataLength, minimumLength)
  );

  const ciphertext = Buffer.from(
    bytes.subarray(minimumLength)
  );

  const key = deriveKey(password, salt);

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      iv
    );

    decipher.setAAD(metadata);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
  } catch {
    throw new Error(
      'Incorrect password or damaged encrypted backup.'
    );
  }
}
