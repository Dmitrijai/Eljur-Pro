/**
 * Authentication and Cryptographic Security Helpers
 * Uses standard Web Crypto API for PBKDF2-HMAC-SHA256 (100,000 iterations) with unique salt
 */

export async function hashPasswordWithBytes(password: string, saltBytes: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const hashArr = Array.from(new Uint8Array(derivedBits));
  return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  return hashPasswordWithBytes(password, enc.encode(salt));
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}

export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface VerificationResult {
  valid: boolean;
  needsRehash: boolean;
  newSalt?: string;
  newHash?: string;
}

export async function verifyUserPasswordDetailed(
  user: { password?: string; passwordHash?: string; passwordSalt?: string },
  inputPass: string
): Promise<VerificationResult> {
  // 1. If PBKDF2 hash and salt exist
  if (user.passwordHash && user.passwordSalt) {
    const computed = await hashPassword(inputPass, user.passwordSalt);
    if (computed === user.passwordHash) {
      return { valid: true, needsRehash: false };
    }

    // Check if salt was encoded as raw hex bytes during server/cloud seed
    const rawSaltBytes = hexToBytes(user.passwordSalt);
    if (rawSaltBytes) {
      const computedHexSalt = await hashPasswordWithBytes(inputPass, rawSaltBytes);
      if (computedHexSalt === user.passwordHash) {
        const newSalt = generateSalt();
        const newHash = await hashPassword(inputPass, newSalt);
        return { valid: true, needsRehash: true, newSalt, newHash };
      }
    }

    // Check if it was legacy single SHA-256
    const enc = new TextEncoder();
    const data = enc.encode(inputPass + '::' + user.passwordSalt);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const legacySha256 = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (legacySha256 === user.passwordHash) {
      const newSalt = generateSalt();
      const newHash = await hashPassword(inputPass, newSalt);
      return { valid: true, needsRehash: true, newSalt, newHash };
    }

    // Check if user.password was updated directly (e.g. by Creator/Director or seed) and re-hash
    if (user.password !== undefined && user.password === inputPass) {
      const newSalt = generateSalt();
      const newHash = await hashPassword(inputPass, newSalt);
      return { valid: true, needsRehash: true, newSalt, newHash };
    }

    return { valid: false, needsRehash: false };
  }

  // 2. Legacy fallback for old plaintext passwords -> triggers mandatory automatic re-hash to PBKDF2
  if (user.password !== undefined && user.password === inputPass) {
    const newSalt = generateSalt();
    const newHash = await hashPassword(inputPass, newSalt);
    return { valid: true, needsRehash: true, newSalt, newHash };
  }

  return { valid: false, needsRehash: false };
}

export async function verifyUserPassword(
  user: { password?: string; passwordHash?: string; passwordSalt?: string },
  inputPass: string
): Promise<boolean> {
  const res = await verifyUserPasswordDetailed(user, inputPass);
  return res.valid;
}

