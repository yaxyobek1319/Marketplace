import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Permissions, Public } from '../auth/access';
import { ensure, required } from '../common/core';
interface ImageFile {
  buffer: Buffer;
  size: number;
}
export function imageExtension(data: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (data.length > 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'jpg';
  if (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP')
    return 'webp';
  return null;
}
@Controller('media/products')
export class MediaController {
  private readonly directory = resolve(process.env.UPLOAD_DIR ?? 'uploads/products');
  @Post()
  @Permissions('seller:own')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } }),
  )
  async upload(@UploadedFile() file: ImageFile | undefined) {
    if (!file?.buffer) throw new BadRequestException('Rasm fayli kerak');
    const ext = imageExtension(file.buffer);
    if (!ext) throw new BadRequestException('Faqat PNG, JPEG yoki WebP qabul qilinadi');
    const base = process.env.PUBLIC_API_BASE_URL;
    ensure(base, 'PUBLIC_API_BASE_URL sozlanmagan');
    const url = new URL(base);
    ensure(
      url.protocol === 'https:' ||
        (process.env.NODE_ENV !== 'production' &&
          ['localhost', '127.0.0.1'].includes(url.hostname)),
      'Ommaviy URL HTTPS bo‘lsin',
    );
    const filename = `${randomUUID()}.${ext}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, filename), file.buffer, { flag: 'wx', mode: 0o644 });
    return { url: `${base.replace(/\/$/, '')}/api/v1/media/products/${filename}` };
  }
  @Public() @Get(':filename') async image(@Param('filename') filename: string) {
    if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(filename)) throw new BadRequestException();
    const handle = await open(join(this.directory, filename), 'r').catch(() => null);
    required(handle, 'Rasm topilmadi');
    const type = filename.endsWith('.jpg')
      ? 'image/jpeg'
      : filename.endsWith('.png')
        ? 'image/png'
        : 'image/webp';
    return new StreamableFile(handle!.createReadStream(), { type, disposition: 'inline' });
  }
}
