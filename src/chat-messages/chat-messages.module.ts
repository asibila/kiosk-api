import { Module } from '@nestjs/common';
import { ChatMessagesController } from './chat-messages.controller.js';
import { ChatMessagesService } from './chat-messages.service.js';

@Module({
  controllers: [ChatMessagesController],
  providers: [ChatMessagesService],
  exports: [ChatMessagesService],
})
export class ChatMessagesModule {}
