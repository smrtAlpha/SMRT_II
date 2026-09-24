import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import ChatWindow from './components/ChatWindow';
import IconRail from './components/IconRail';
import type { View } from './components/IconRail';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import StatusBar from './components/StatusBar';
import Modal from './components/Modal';
import KnowledgePackUpload from './components/KnowledgePackUpload';
import AccountPanel from './components/AccountPanel';
import SettingsView from './components/SettingsView';
import FilesView from './components/FilesView';
import DataView from './components/DataView';
import WriteView from './components/WriteView';
import NotificationToggle from './components/NotificationToggle';
import ResearchQueueForm from './components/ResearchQueueForm';
import ResearchQueueList from './components/ResearchQueueList';
import { useAuth } from './lib/useAuth';
import { useOnlineStatus } from './lib/useOnlineStatus';
import { refreshPendingResearchTasks } from './lib/refreshPendingTasks';
import { useAccountMigration } from './lib/useAccountMigration';
import { useCloudSync } from './lib/useCloudSync';
import { takeAuthRedirectError } from './lib/authRedirectError';
import { useLaunchPrompt } from './lib/useLaunchPrompt';
import { useLocalModel } from './lib/useLocalModel';
import { db } from './lib/db';
import { WifiOff } from 'lucide-react';
import './App.css';

// Not built yet — Friends needs sync + profiles + live messaging + blocking/reporting first.
const COMING_SOON: Partial<Record<View, string>> = {
  notes: 'Connecting with friends — a chat with schoolmates, tutors and lecturers',
};

function ComingSoonView({ view }: { view: View }) {
  const label = view === 'notes' ? 'Friends' : view;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-slate-400">
      <p className="font-medium capitalize text-slate-500">{label}</p>
      <p className="text-sm">{COMING_SOON[view]} — coming soon.</p>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();
  const isOnline = useOnlineStatus();
  const localModel = useLocalModel();
  const cloudSync = useCloudSync(user, isOnline);
  const [view, setView] = useState<View>('chat');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  // Only matters on mobile, where the sidebar slides in as a drawer.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Shows the "Add a knowledge pack" pop-up.
  const [showUpload, setShowUpload] = useState(false);
  // Shows the research queue pop-up (opened from the status bar).
  const [showQueue, setShowQueue] = useState(false);
  // Shows the account pop-up (create account / sign in / sign out).
  const [showAccount, setShowAccount] = useState(false);
  const [accountError, setAccountError] = useState('');
  // True when the account pop-up was opened by the app itself at launch (it then offers "Continue as guest").
  const [accountAtLaunch, setAccountAtLaunch] = useState(false);

  const userId = user?.id ?? '';
  // A guest is someone who hasn't created an account or signed in yet.
  const isGuest = user?.is_anonymous !== false;

  // After signing in to an existing account, asks whether to add this device's guest chats to it.
  const { notice, clearNotice } = useAccountMigration(user);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clearNotice, 8000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

  // If a Google sign-in just failed, reopen the account pop-up and say why.
  useEffect(() => {
    const message = takeAuthRedirectError();
    if (message) {
      setAccountError(message);
      setShowAccount(true);
    }
  }, []);

  // When the app opens and you are not signed in, offer to sign in or create an account.
  useLaunchPrompt({
    loading,
    isGuest,
    isOnline,
    onShow: () => {
      setAccountAtLaunch(true);
      setShowAccount(true);
    },
  });

  function closeAccount() {
    setShowAccount(false);
    setAccountError('');
    setAccountAtLaunch(false);
  }

  // Waiting research tasks get a fresh login token when the app opens and whenever the connection returns.
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      refreshPendingResearchTasks(userId).catch((err) => console.error('Refreshing waiting tasks failed:', err));
    };
    refresh();
    window.addEventListener('online', refresh);
    return () => window.removeEventListener('online', refresh);
  }, [userId]);

  // Tapping a "research finished" notification opens the research queue.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('queue') === '1') {
      setShowQueue(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'open-queue') setShowQueue(true);
    }
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, []);

  // How many research tasks are still waiting to sync (drives the status bar, not the Sync button).
  const pendingCount =
    useLiveQuery(
      () =>
        db.researchQueue
          .where('userId')
          .equals(userId)
          .and((task) => task.status === 'pending')
          .count(),
      [userId]
    ) ?? 0;

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center text-slate-500">
        <p>Starting SMRT...</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-white md:flex-row">
      <IconRail view={view} onSelectView={setView} email={user?.email ?? null} isGuest={isGuest} onOpenAccount={() => setShowAccount(true)} />
      {view === 'chat' && (
        <Sidebar
          userId={userId}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onAddPack={() => setShowUpload(true)}
          email={user?.email ?? null}
          isGuest={isGuest}
          onOpenAccount={() => setShowAccount(true)}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/60">
        <TopBar
          localModel={localModel}
          isOnline={isOnline}
          cloudSync={cloudSync}
          onOpenMenu={() => setSidebarOpen(true)}
          isGuest={isGuest}
          onOpenAccount={() => setShowAccount(true)}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          {notice && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
              <span>{notice}</span>
              <button type="button" onClick={clearNotice} aria-label="Dismiss" className="shrink-0 text-green-700 hover:text-green-900">
                ✕
              </button>
            </div>
          )}
          {!isOnline && (
            <div className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
              <WifiOff size={14} />
              You're offline — using cached history
            </div>
          )}

          {view === 'chat' && (
            <ChatWindow
              userId={userId}
              conversationId={activeConversationId}
              onNewConversation={setActiveConversationId}
              localModel={localModel}
            />
          )}
          {view === 'settings' && (
            <SettingsView user={user} localModel={localModel} onSignedOut={() => setActiveConversationId(null)} />
          )}
          {view === 'files' && (
            <FilesView
              userId={userId}
              onOpenConversation={(id) => {
                setActiveConversationId(id);
                setView('chat');
              }}
            />
          )}
          {view === 'data' && <DataView userId={userId} />}
          {view === 'write' && <WriteView userId={userId} />}
          {view === 'notes' && <ComingSoonView view={view} />}
        </div>
        <StatusBar isOnline={isOnline} pendingCount={pendingCount} onOpenQueue={() => setShowQueue(true)} />
      </div>

      {showAccount && (
        <Modal title={accountAtLaunch ? 'Welcome to SMRT' : 'Account'} onClose={closeAccount}>
          <AccountPanel
            user={user}
            startError={accountError}
            onClose={closeAccount}
            onSignedOut={() => setActiveConversationId(null)}
            onContinueAsGuest={accountAtLaunch ? closeAccount : undefined}
          />
        </Modal>
      )}

      {showQueue && (
        <Modal title="Research queue" onClose={() => setShowQueue(false)}>
          <NotificationToggle />
          <ResearchQueueForm userId={userId} />
          <ResearchQueueList userId={userId} />
        </Modal>
      )}

      {showUpload && (
        <Modal title="Add a knowledge pack" onClose={() => setShowUpload(false)}>
          <KnowledgePackUpload userId={userId} />
        </Modal>
      )}
    </div>
  );
}

export default App;