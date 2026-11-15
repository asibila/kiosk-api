import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ChatEventsModule } from './chat-events/chat-events.module.js';
import { ChatMessagesModule } from './chat-messages/chat-messages.module.js';
import { ChatThreadsModule } from './chat-threads/chat-threads.module.js';
import { DescriptionsModule } from './descriptions/descriptions.module.js';
import { FacetSchemasModule } from './facet-schemas/facet-schemas.module.js';
import { FacetValueOptionsModule } from './facet-value-options/facet-value-options.module.js';
import { FacetValueSelectionsModule } from './facet-value-selections/facet-value-selections.module.js';
import { InboxItemsModule } from './inbox-items/inbox-items.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { ListingChatThreadsModule } from './listing-chat-threads/listing-chat-threads.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ChatEventsModule,
    UsersModule,
    AuthModule,
    ListingsModule,
    CategoriesModule,
    DescriptionsModule,
    ChatMessagesModule,
    ChatThreadsModule,
    ListingChatThreadsModule,
    InboxItemsModule,
    FacetSchemasModule,
    FacetValueOptionsModule,
    FacetValueSelectionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Validates parameters annotated with `{ schema }`, such as
    // `@Body({ schema: createUserSchema })`.
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
  ],
})
export class AppModule {}
