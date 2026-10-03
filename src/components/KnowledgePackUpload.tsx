import { useState } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { extractTextFromFile } from '../lib/extractText';
import { db } from '../lib/db';
import { supabase } from '../lib/supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-pack`;

type Props = { userId: string };
type Status = 'idle' | 'extracting' | 'summarizing' | 'done' | 'error';

export default function KnowledgePackUpload({ userId }: Props) {
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!subject.trim()) {
      setErrorMsg('Give this knowledge pack a subject name first.');
      return;
    }

    setErrorMsg('');
    setStatus('extracting');

    try {
      const rawText = await extractTextFromFile(file);

      setStatus('summarizing');
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ text: rawText }),
      });

      if (!res.ok) {
        // The server explains limits in plain words (e.g. "reached today's limit").
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === 'string' ? data.error : `Summarization failed (${res.status})`);
      }
      const { summary } = await res.json();

      await db.knowledgePacks.add({
        id: crypto.randomUUID(),
        userId,
        subject: subject.trim(),
        sourceFileName: file.name,
        summary,
        timestamp: Date.now(),
      });

      setStatus('done');
    } catch (err) {
      console.error('Knowledge pack processing failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      setStatus('error');
    }
  }

  const busy = status === 'extracting' || status === 'summarizing';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 text-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Upload size={14} />
        <span>Add a knowledge pack</span>
      </div>
      <input
        type="text"
        placeholder="Subject (e.g. Organic Chemistry)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        disabled={busy}
        className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm backdrop-blur-sm transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:opacity-50"
      />
      <input
        type="file"
        accept=".pdf,.docx,.txt,.md"
        onChange={handleFile}
        disabled={busy}
        className="text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 file:transition-colors hover:file:bg-blue-100 disabled:opacity-50"
      />
      {status === 'extracting' && (
        <p className="flex items-center gap-2 text-slate-500">
          <Loader2 size={14} className="shrink-0 animate-spin" />
          Reading document...
        </p>
      )}
      {status === 'summarizing' && (
        <p className="flex items-center gap-2 text-slate-500">
          <Loader2 size={14} className="shrink-0 animate-spin" />
          Condensing into a knowledge pack (can take a moment for large files)...
        </p>
      )}
      {status === 'done' && (
        <p className="flex items-center gap-2 text-green-700">
          <CheckCircle2 size={14} className="shrink-0" />
          Knowledge pack saved — available offline.
        </p>
      )}
      {(status === 'error' || errorMsg) && status !== 'done' && !busy && (
        <p className="flex items-start gap-2 text-red-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {errorMsg}
        </p>
      )}
    </div>
  );
}