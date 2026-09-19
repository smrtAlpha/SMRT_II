export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // Names of files that were attached to this message (user messages only)
  attachments?: string[];
};