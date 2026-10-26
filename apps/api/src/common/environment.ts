import { config } from 'dotenv';
import { resolve } from 'node:path';

// Both src/common and dist/common are two levels below apps/api.
// Resolve independently of the directory from which node was launched.
config({ path: resolve(__dirname, '../../.env') });

export function validateStartupEnvironment() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL_MISSING');
  }
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT_INVALID');
  }
}

export function startupErrorMessage(error: unknown): string {
  const e = error as { code?: string; errorCode?: string; message?: string; name?: string } | null;
  const code = e?.errorCode ?? e?.code;
  if (e?.message === 'DATABASE_URL_MISSING') {
    return 'DATABASE_URL berilmagan. apps/api/.env.example nusxasini apps/api/.env sifatida yarating va DATABASE_URL ni belgilang. Faqat Swagger uchun: npm run swagger (DB kerak emas).';
  }
  if (e?.message === 'PORT_INVALID') return 'PORT 1–65535 oralig‘idagi butun son bo‘lishi kerak.';
  const messages: Record<string, string> = {
    P1000: 'DB login yoki paroli noto‘g‘ri. DATABASE_URL ni tekshiring.',
    P1001: 'DB serveriga ulanib bo‘lmadi. PostgreSQL ishga tushganini, host va portni tekshiring.',
    P1002: 'DB ulanishida kutish vaqti tugadi.',
    P1003: 'DATABASE_URL da ko‘rsatilgan baza mavjud emas.',
    P1010: 'DB foydalanuvchisiga bazaga kirish ruxsati berilmagan.',
    P1011: 'DB TLS ulanishi ishlamadi. Sertifikat va SSL sozlamalarini tekshiring.',
    P1012: 'Prisma konfiguratsiyasi yaroqsiz. DATABASE_URL va Prisma sxemasini tekshiring.',
    P1013: 'DATABASE_URL formati noto‘g‘ri.',
    EADDRINUSE: 'API porti band. Oldingi API jarayonini to‘xtating yoki PORT ni almashtiring.',
    EACCES: 'API host/portiga ulanish uchun tizim ruxsati yetarli emas.',
    EPERM: 'Tizim API portini ochishga ruxsat bermadi.',
    ECONNREFUSED: 'Tashqi xizmat ulanishni rad etdi. DB va Redis mavjudligini tekshiring.',
  };
  if (code && messages[code]) return `[${code}] ${messages[code]}`;
  // Never print arbitrary exception messages: provider URLs can contain credentials.
  const label = [e?.name, code].filter((v) => typeof v === 'string' && /^[A-Za-z0-9_]+$/.test(v));
  return `Ishga tushish xatosi${label.length ? ` (${label.join(', ')})` : ''}. API konfiguratsiyasi va tashqi xizmatlarni tekshiring.`;
}
