import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { createLoginSchema, type CreateLoginDto } from './dto/create-login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body({ schema: createLoginSchema }) dto: CreateLoginDto): Promise<{ userId: number }> {
    return this.authService.login(dto.email, dto.password);
  }
}
