import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('threads')
  open(@Body() body: { buyerId: string; stallId: string }) {
    return this.chat.open(body);
  }

  @Get('threads/:id')
  get(@Param('id') id: string) {
    return this.chat.get(id);
  }

  @Post('threads/:id/messages')
  message(
    @Param('id') id: string,
    @Body()
    body: {
      fromId: string;
      lang: string;
      text?: string;
      voice?: { durationMs: number; transcript?: string };
    },
  ) {
    if (body.voice) {
      return this.chat.postVoice(id, {
        fromId: body.fromId,
        lang: body.lang,
        durationMs: body.voice.durationMs,
        transcript: body.voice.transcript,
      });
    }
    return this.chat.postText(id, { fromId: body.fromId, lang: body.lang, text: body.text ?? '' });
  }

  @Post('threads/:id/read')
  read(@Param('id') id: string, @Body() body: { readerId: string }) {
    this.chat.markDelivered(id);
    return this.chat.markRead(id, body.readerId);
  }
}
