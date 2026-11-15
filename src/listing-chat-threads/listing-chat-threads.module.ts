import { Module } from '@nestjs/common';
import { ListingChatThreadsController } from './listing-chat-threads.controller.js';
import { ListingChatThreadsService } from './listing-chat-threads.service.js';

@Module({
  controllers: [ListingChatThreadsController],
  providers: [ListingChatThreadsService],
  exports: [ListingChatThreadsService],
})
export class ListingChatThreadsModule {}
