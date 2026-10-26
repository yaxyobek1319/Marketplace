import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';
import { z } from 'zod';
import { encrypt, hashSecret } from '../src/auth/security';
// Operator-only command. Read secrets through stdin, never CLI args, logs or committed seed data.
async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const data = z
    .object({
      email: z
        .string()
        .email()
        .transform((v) => v.toLowerCase()),
      fullName: z.string().min(1),
      password: z.string().min(14).max(256),
      role: z.enum(['MODERATOR', 'SUPER_ADMIN']),
      totpSecret: z.string().min(16).optional(),
    })
    .strict()
    .parse(JSON.parse(input));
  if (data.role === 'SUPER_ADMIN' && !data.totpSecret)
    throw new Error('Super Admin requires a pre-provisioned TOTP secret');
  if (data.totpSecret && !/^[A-Z2-7]+$/.test(data.totpSecret))
    throw new Error('Invalid base32 TOTP secret');
  const db = new PrismaClient();
  try {
    await db.staffAccount.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        passwordHash: await hashSecret(data.password),
        role: data.role,
        twoFactorEnabled: !!data.totpSecret,
        twoFactorSecretEncrypted: data.totpSecret ? encrypt(data.totpSecret) : null,
      },
    });
    process.stdout.write('Staff account created.\n');
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  process.stderr.write(
    'Staff provisioning failed. Check input/configuration and duplicate email.\n',
  );
  process.exitCode = 1;
});
