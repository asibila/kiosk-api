import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';

interface MulterFailure {
  name: 'MulterError';
  code?: string;
  message: string;
}

const isMulterFailure = (error: unknown): error is MulterFailure =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: string }).name === 'MulterError';

/**
 * FileInterceptor rejects oversized/invalid multipart uploads with a multer
 * error that is not an HttpException (and would otherwise become a 500).
 * This filter maps those to 413/400 while leaving HttpExceptions untouched.
 */
@Catch()
export class UploadExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (isMulterFailure(exception)) {
      const status = exception.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      response.status(status).json({
        statusCode: status,
        message: `Upload failed: ${exception.message}`,
      });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
    });
  }
}
