import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { CurrentUser, type RequestUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import {
  readSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionTtlMs,
} from './session-cookie.js';
import { createLoginSchema, type CreateLoginDto } from './dto/create-login.dto.js';
import { registerSchema, type RegisterDto } from './dto/register.dto.js';
import { UsersService } from '../users/users.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: createLoginSchema }) dto: CreateLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RequestUser> {
    const user = await this.authService.login(dto.email, dto.password);
    const userAgent = request.headers['user-agent'];
    const { token } = await this.authService.createSession(
      user.id,
      Array.isArray(userAgent) ? userAgent[0] : userAgent,
    );

    response.cookie(SESSION_COOKIE, token, sessionCookieOptions(sessionTtlMs()));
    return user;
  }

  /**
   * Signup: creates the account and signs it in with the same session cookie as
   * `login`, so the client needs one request. Duplicate emails answer `409`.
   */
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  async register(
    @Body({ schema: registerSchema }) dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RequestUser> {
    const user = await this.usersService.create(
      { name: dto.name, email: dto.email, password: dto.password },
      null,
      { acceptedTermsAt: new Date() },
    );

    const userAgent = request.headers['user-agent'];
    const { token } = await this.authService.createSession(
      user.id,
      Array.isArray(userAgent) ? userAgent[0] : userAgent,
    );

    response.cookie(SESSION_COOKIE, token, sessionCookieOptions(sessionTtlMs()));
    return user;
  }

  @Public()
  @Get('me')
  me(@CurrentUser() user: RequestUser | null): RequestUser | null {
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookie = request.headers.cookie;
    const token = readSessionToken(Array.isArray(cookie) ? cookie[0] : cookie);
    if (token) await this.authService.revokeSession(token);
    response.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
