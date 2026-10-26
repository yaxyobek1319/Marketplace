import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(secret, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifySecret(secret: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected || expected.length !== 128) return false;
  const actual = (await scrypt(secret, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
function key() {
  const value = process.env.SECRET_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error('SECRET_ENCRYPTION_KEY must contain 32 random bytes as hex');
  return Buffer.from(value, 'hex');
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  return (() => {
    const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${body.toString('hex')}`;
  })();
}
export function decrypt(value: string) {
  const [iv, tag, body] = value.split(':');
  const cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'hex'));
  cipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([cipher.update(Buffer.from(body, 'hex')), cipher.final()]).toString('utf8');
}
