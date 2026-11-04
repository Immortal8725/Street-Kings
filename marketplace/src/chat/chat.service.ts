import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Clock } from '../common/clock';
import { IdFactory } from '../common/ids';
import { I18nService } from '../i18n/i18n.service';
import { SellersService } from '../sellers/sellers.service';
import { ChatMessage, ChatThread, VoiceNote } from './chat.types';

@Injectable()
export class ChatService {
  private readonly threads = new Map<string, ChatThread>();

  constructor(
    private readonly ids: IdFactory,
    private readonly clock: Clock,
    private readonly i18n: I18nService,
    private readonly sellers: SellersService,
  ) {}

  open(input: { buyerId: string; stallId: string }): ChatThread {
    const stall = this.sellers.get(input.stallId);
    const existing = [...this.threads.values()].find(
      (thread) => thread.buyerId === input.buyerId && thread.stallId === stall.id,
    );
    if (existing) return existing;
    const thread: ChatThread = {
      id: this.ids.next('chat'),
      buyerId: input.buyerId,
      sellerId: stall.sellerId,
      stallId: stall.id,
      messages: [],
    };
    this.threads.set(thread.id, thread);
    return thread;
  }

  get(id: string): ChatThread {
    const thread = this.threads.get(id);
    if (!thread) throw new NotFoundException(`Thread ${id} not found`);
    return thread;
  }

  postText(threadId: string, input: { fromId: string; lang: string; text: string }): ChatMessage {
    if (!input.text.trim()) throw new BadRequestException('Message is empty');
    return this.append(threadId, input.fromId, input.lang, { kind: 'text', text: input.text.trim() });
  }

  postVoice(
    threadId: string,
    input: { fromId: string; lang: string; durationMs: number; transcript?: string },
  ): ChatMessage {
    if (input.durationMs <= 0) throw new BadRequestException('Voice note duration is required');
    const noteId = this.ids.next('voice');
    const voice: VoiceNote = {
      noteId,
      durationMs: input.durationMs,
      storageKey: `voice/${noteId}.webm`,
      transcript: input.transcript,
    };
    return this.append(threadId, input.fromId, input.lang, { kind: 'voice', voice });
  }

  markDelivered(threadId: string): ChatThread {
    const thread = this.get(threadId);
    for (const message of thread.messages) {
      if (message.tick === 'sent') message.tick = 'delivered';
    }
    return thread;
  }

  markRead(threadId: string, readerId: string): ChatThread {
    const thread = this.get(threadId);
    for (const message of thread.messages) {
      if (message.fromId !== readerId) message.tick = 'read';
    }
    return thread;
  }

  private append(
    threadId: string,
    fromId: string,
    lang: string,
    payload: Pick<ChatMessage, 'kind' | 'text' | 'voice'>,
  ): ChatMessage {
    const thread = this.get(threadId);
    if (fromId !== thread.buyerId && fromId !== thread.sellerId) {
      throw new BadRequestException('Sender is not in this thread');
    }
    this.i18n.assertCode(lang);
    const message: ChatMessage = {
      id: this.ids.next('msg'),
      fromId,
      lang,
      tick: 'sent',
      at: this.clock.iso(),
      ...payload,
    };
    thread.messages.push(message);
    return message;
  }
}
