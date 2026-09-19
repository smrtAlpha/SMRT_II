import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import ChatWindow from './components/ChatWindow';
import IconRail from './components/IconRail';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import StatusBar from './components/StatusBar';
import Modal from './components/Modal';
import KnowledgePackUpload from './components/KnowledgePackUpload';
import ResearchQueueForm from './components/ResearchQueueForm';
import ResearchQueueList from './components/ResearchQueueList';
import { useAuth } from './lib/useAuth';
import { useOnlineStatus } from './lib/useOnlineStatus';
import { useLocalModel } from './lib/useLocalModel';
import { db } from './lib/db';
import { WifiOff } from 'lucide-react';
import './App.css';

function App() {
  const { user, loading } = useAuth();
  const isOnline = useOnlineStatus();
  const localModel = useLocalModel();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  // Only matters on mobile, where the sidebar slides in as a drawer.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Shows the "Add a knowledge pack" pop-up.
  const [showUpload, setShowUpload] = useState(false);
  // Shows the research queue pop-up (opened from the status bar).
  const [showQueue, setShowQueue] = useState(false);

  const userId = user?.id ?? '';

  // How many research tasks are still waiting to sync (drives the Sync dot).
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
    <div className="flex h-dvh bg-white">
      <IconRail userId={userId} />
      <Sidebar
        userId={userId}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onAddPack={() => setShowUpload(true)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          localModel={localModel}
          isOnline={isOnline}
          pendingCount={pendingCount}
          onOpenMenu={() => setSidebarOpen(true)}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          {!isOnline && (
            <div className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
              <WifiOff size={14} />
              You're offline — using cached history
            </div>
          )}
          <ChatWindow
            userId={userId}
            conversationId={activeConversationId}
            onNewConversation={setActiveConversationId}
            localModel={localModel}
          />
        </div>
        <StatusBar isOnline={isOnline} pendingCount={pendingCount} onOpenQueue={() => setShowQueue(true)} />
      </div>

      {showQueue && (
        <Modal title="Research queue" onClose={() => setShowQueue(false)}>
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