import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  User,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  FileText,
  Globe,
  Cpu,
  History,
  Info,
  GraduationCap,
  RotateCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Logo from './Logo';
import { splitLabels } from '../lib/messageLabels';
import type { ChatMessage } from '../types';

type Props = {
  messages: ChatMessage[];
  // Retry is offered on the newest answer, and only while nothing is being generated.
  canRetry?: boolean;
  onRetry?: (messageId: string) => void;
};

const ACTION_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600';

// Row of small buttons under each assistant message. Only "Copy" is real for now.
function MessageActions({ content, onRetry }: { content: string; onRetry?: () => void }) {
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
      {onRetry && (
        <button type="button" onClick={onRetry} title="Try again" aria-label="Try again" className={ACTION_BUTTON}>
          <RotateCcw size={16} />
        </button>
      )}
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

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type BadgeStyle = { Icon: LucideIcon; className: string; text: string };

function badgeFor(label: string): BadgeStyle {
  const lower = label.toLowerCase();
  if (lower.includes('not found') && lower.includes('outside')) {
    return { Icon: Globe, className: 'bg-amber-50 text-amber-700', text: 'Outside source — not found in your attached file' };
  }
  if (lower.includes('attached file')) {
    return { Icon: FileText, className: 'bg-blue-50 text-blue-700', text: capitalize(label) };
  }
  if (lower.includes('offline history')) {
    return { Icon: History, className: 'bg-slate-100 text-slate-600', text: capitalize(label) };
  }
  if (lower.includes('offline')) {
    return { Icon: Cpu, className: 'bg-slate-100 text-slate-600', text: capitalize(label) };
  }
  if (lower.includes('knowledge pack')) {
    return { Icon: GraduationCap, className: 'bg-blue-50 text-blue-700', text: capitalize(label) };
  }
  return { Icon: Info, className: 'bg-slate-100 text-slate-600', text: capitalize(label) };
}

function AssistantMessage({ content, onRetry }: { content: string; onRetry?: () => void }) {
  const { labels, body } = splitLabels(content);

  return (
    <div className="flex animate-[fadeInUp_0.25s_ease-out] items-start gap-3">
      <Logo size={32} className="mt-1" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          {labels.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {labels.map((label, i) => {
                const { Icon, className, text } = badgeFor(label);
                return (
                  <span
                    key={`${label}-${i}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
                  >
                    <Icon size={12} className="shrink-0" />
                    {text}
                  </span>
                );
              })}
            </div>
          )}
          {body === '' ? (
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </div>
          )}
        </div>
        {body !== '' && <MessageActions content={body} onRetry={onRetry} />}
      </div>
    </div>
  );
}

export default function MessageList({ messages, canRetry = false, onRetry }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Nothing to show yet: a friendly welcome instead of a blank screen.
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <Logo size={56} className="mb-2 rounded-2xl" />
        <h2 className="text-xl font-semibold text-blue-950">Ask SMRT anything</h2>
        <p className="max-w-xs text-sm text-slate-500">Your study companion. It keeps working even when you're offline.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 py-3">
        {messages.map((msg, index) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="flex animate-[fadeInUp_0.25s_ease-out] items-start justify-end gap-3">
              <div className="flex max-w-[85%] flex-col items-end gap-1.5 md:max-w-[75%]">
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {msg.attachments.map((name, i) => (
                      <span
                        key={`${name}-${i}`}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs text-blue-800"
                      >
                        <FileText size={14} className="shrink-0" />
                        <span className="max-w-[14rem] truncate">{name}</span>
                      </span>
                    ))}
                  </div>
                )}
                <div className="rounded-2xl bg-blue-100 px-4 py-2.5 text-sm whitespace-pre-wrap text-slate-900">
                  {msg.content}
                </div>
              </div>
              <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 sm:flex">
                <User size={18} />
              </span>
            </div>
          ) : (
            <AssistantMessage
              key={msg.id}
              content={msg.content}
              onRetry={
                canRetry && onRetry && index === messages.length - 1 && messages[index - 1]?.role === 'user'
                  ? () => onRetry(msg.id)
                  : undefined
              }
            />
          )
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}