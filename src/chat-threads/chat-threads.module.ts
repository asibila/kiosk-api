import { Module } from '@nestjs/common';
import { ChatThreadsController } from './chat-threads.controller.js';
import { ChatThreadsService } from './chat-threads.service.js';

@Module({
  controllers: [ChatThreadsController],
  providers: [ChatThreadsService],
  exports: [ChatThreadsService],
})
export class ChatThreadsModule {}
