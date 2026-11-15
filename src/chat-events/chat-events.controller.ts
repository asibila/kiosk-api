import { Controller, type MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, type Observable } from 'rxjs';
import { ChatEventsService } from './chat-events.service.js';

@Controller('chat-events')
export class ChatEventsController {
  constructor(private readonly chatEvents: ChatEventsService) {}

  /**
   * Server-Sent Events stream consumed by the frontend's EventSource.
   * A heartbeat keeps idle proxies from closing the connection.
   */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    const heartbeat = interval(15_000).pipe(
      map(() => ({ data: { type: 'ping', at: new Date().toISOString() } })),
    );

    return merge(
      this.chatEvents.events$,
      heartbeat,
    ).pipe(map((event) => ({ data: event })));
  }
}
