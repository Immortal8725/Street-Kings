export type MessageTick = 'sent' | 'delivered' | 'read';

export interface VoiceNote {
  noteId: string;
  durationMs: number;
  storageKey: string;
  transcript?: string;
}

export interface ChatMessage {
  id: string;
  fromId: string;
  kind: 'text' | 'voice';
  lang: string;
  text?: string;
  voice?: VoiceNote;
  tick: MessageTick;
  at: string;
}

export interface ChatThread {
  id: string;
  buyerId: string;
  sellerId: string;
  stallId: string;
  messages: ChatMessage[];
}
