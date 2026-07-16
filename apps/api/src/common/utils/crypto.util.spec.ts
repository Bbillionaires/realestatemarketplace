import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { CryptoService } from './crypto.util';

function buildCryptoService(): CryptoService {
  const configService = {
    get: (key: string) => {
      if (key === 'phoneEncryptionKey') return '7VSfU7jvbU4SReOkNV6lO3qEncxgADEFwitsAdIA1U8=';
      if (key === 'phoneHashSecret') return 'unit-test-hash-secret';
      return undefined;
    },
  } as unknown as ConfigService<AppConfig>;
  return new CryptoService(configService);
}

describe('CryptoService', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const crypto = buildCryptoService();
    const plaintext = '+19045551234';
    const ciphertext = crypto.encrypt(plaintext);

    expect(ciphertext).not.toContain(plaintext);
    expect(crypto.decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const crypto = buildCryptoService();
    const a = crypto.encrypt('+19045551234');
    const b = crypto.encrypt('+19045551234');
    expect(a).not.toBe(b);
  });

  it('produces a deterministic hash for lookups', () => {
    const crypto = buildCryptoService();
    const hash1 = crypto.hash('+19045551234');
    const hash2 = crypto.hash('+19045551234');
    expect(hash1).toBe(hash2);
    expect(hash1).not.toContain('9045551234');
  });

  it('produces different hashes for different numbers', () => {
    const crypto = buildCryptoService();
    expect(crypto.hash('+19045551234')).not.toBe(crypto.hash('+19045559999'));
  });

  it('rejects a 32-byte-key requirement violation', () => {
    const badConfig = {
      get: (key: string) => {
        if (key === 'phoneEncryptionKey') return 'dG9vc2hvcnQ='; // too short
        if (key === 'phoneHashSecret') return 'secret';
        return undefined;
      },
    } as unknown as ConfigService<AppConfig>;
    expect(() => new CryptoService(badConfig)).toThrow();
  });
});
