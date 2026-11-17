import { Controller, type MessageEvent, Sse } from '@nestjs/common';
import {
  filter,
  interval,
  map,
  merge,
  mergeMap,
  type Observable,
} from 'rxjs';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { AccessService } from '../common/access.service.js';
import { ChatEventsService, type ChatEvent } from './chat-events.service.js';

@Controller('chat-events')
export class ChatEventsController {
  constructor(
    private readonly chatEvents: ChatEventsService,
    private readonly access: AccessService,
  ) {}

  /**
   * Server-Sent Events stream consumed by the frontend's EventSource. Only
   * events for threads the signed-in user takes part in are forwarded. A
   * heartbeat keeps idle proxies from closing the connection.
   */
  @Sse('stream')
  stream(@CurrentUser() user: RequestUser): Observable<MessageEvent> {
    const heartbeat = interval(15_000).pipe(
      map(() => ({ type: 'ping', at: new Date().toISOString() })),
    );

    const events = this.chatEvents.events$.pipe(
      mergeMap(async (event) => {
        if (
          event.type === 'message.created' ||
          event.type === 'message.updated'
        ) {
          const allowed = await this.access.isThreadParticipant(
            user,
            event.message.threadId,
          );
          return allowed ? event : null;
        }
        return event;
      }),
      filter((event): event is ChatEvent => event !== null),
    );

    return merge(events, heartbeat).pipe(map((event) => ({ data: event })));
  }
}
