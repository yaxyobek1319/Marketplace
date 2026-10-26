import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';
@Catch(Prisma.PrismaClientKnownRequestError)
export class DatabaseErrorFilter implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status =
      error.code === 'P2002' || error.code === 'P2034' ? 409 : error.code === 'P2025' ? 404 : 500;
    response.status(status).json({
      statusCode: status,
      message:
        status === 409
          ? 'Amal takrorlangan yoki ma’lumot o‘zgargan. Qayta tekshiring.'
          : status === 404
            ? 'Topilmadi'
            : 'Ma’lumotlar bazasi xatosi',
    });
  }
}
