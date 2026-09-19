import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Copy, Check, ThumbsUp, ThumbsDown, MoreHorizontal } from 'lucide-react';
import Logo from './Logo';
import type { ChatMessage } from '../types';

type Props = {
  messages: ChatMessage[];
};

const ACTION_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600';

// Row of small buttons under each assistant message. Only "Copy" is real for now.
function MessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  return (
    <div className="mt-1.5 flex items-center gap-0.5 pl-1">
      <button type="button" onClick={handleCopy} title="Copy" aria-label="Copy message" className={ACTION_BUTTON}>
        {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
      </button>
      <button type="button" title="Good answer — coming soon" aria-label="Good answer" className={ACTION_BUTTON}>
        <ThumbsUp size={16} />
      </button>
      <button type="button" title="Bad answer — coming soon" aria-label="Bad answer" className={ACTION_BUTTON}>
        <ThumbsDown size={16} />
      </button>
      <button type="button" title="More — coming soon" aria-label="More options" className={ACTION_BUTTON}>
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}

// Styling for the markdown inside assistant answers (paragraphs, lists, code, tables).
const MARKDOWN_STYLES = [
  'overflow-x-auto text-sm leading-relaxed text-slate-800',
  '[&>:first-child]:mt-0 [&>:last-child]:mb-0',
  '[&_p]:my-2 [&_strong]:font-semibold',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_h1]:my-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:my-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:font-semibold',
  '[&_a]:text-blue-600 [&_a]:underline',
  '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:text-[0.85em]',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-slate-100',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left',
  '[&_th]:min-w-24 [&_th]:bg-blue-50 [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-blue-950',
  '[&_td]:min-w-24 [&_td]:border-t [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top',
].join(' ');

export default function MessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 py-3">
        {messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="flex animate-[fadeInUp_0.25s_ease-out] items-start justify-end gap-3">
              <div className="max-w-[85%] rounded-2xl bg-blue-100 px-4 py-2.5 text-sm whitespace-pre-wrap text-slate-900 md:max-w-[75%]">
                {msg.content}
              </div>
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 sm:flex">
                <User size={18} />
              </span>
            </div>
          ) : (
            <div key={msg.id} className="flex animate-[fadeInUp_0.25s_ease-out] items-start gap-3">
              <Logo size={32} className="mt-1" />
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  {msg.content === '' ? (
                    <div className="flex gap-1 py-1">
                      <span className="h-1.5 w-1.5 animate-[bounce-dot_1.2s_ease-in-out_infinite] rounded-full bg-slate-500" />
                      <span
                        className="h-1.5 w-1.5 animate-[bounce-dot_1.2s_ease-in-out_infinite] rounded-full bg-slate-500"
                        style={{ animationDelay: '0.15s' }}
                      />
                      <span
                        className="h-1.5 w-1.5 animate-[bounce-dot_1.2s_ease-in-out_infinite] rounded-full bg-slate-500"
                        style={{ animationDelay: '0.3s' }}
                      />
                    </div>
                  ) : (
                    <div className={MARKDOWN_STYLES}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
                {msg.content !== '' && <MessageActions content={msg.content} />}
              </div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}