import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Field-level encryption for real phone numbers (and any other PII that must
 * never be stored or logged in plaintext). Ciphertext format:
 * base64(iv) + '.' + base64(authTag) + '.' + base64(ciphertext).
 *
 * `hash()` produces a keyed HMAC used purely for lookups (e.g. matching an
 * inbound SMS "from" number to a PhoneNumber row) so plaintext numbers never
 * need to be decrypted for routing.
 */
@Injectable()
export class CryptoService {
  private readonly encryptionKey: Buffer;
  private readonly hashSecret: string;

  constructor(configService: ConfigService<AppConfig>) {
    const keyB64 = configService.get('phoneEncryptionKey', { infer: true }) as string;
    this.hashSecret = configService.get('phoneHashSecret', { infer: true }) as string;

    if (!keyB64 || !this.hashSecret) {
      throw new Error('PHONE_ENCRYPTION_KEY and PHONE_HASH_SECRET must be set');
    }

    const key = Buffer.from(keyB64, 'base64');
    if (key.length !== 32) {
      throw new Error('PHONE_ENCRYPTION_KEY must decode to exactly 32 bytes');
    }
    this.encryptionKey = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Malformed ciphertext payload');
    }
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(dataB64, 'base64');
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  /** Deterministic keyed hash for lookups. Never reversible to plaintext. */
  hash(value: string): string {
    return createHmac('sha256', this.hashSecret).update(value).digest('hex');
  }
}
