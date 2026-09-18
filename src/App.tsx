import { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import Sidebar from './components/Sidebar';
import InstallButton from './components/InstallButton';
import KnowledgePackUpload from './components/KnowledgePackUpload';
import ResearchQueueForm from './components/ResearchQueueForm';
import ResearchQueueList from './components/ResearchQueueList';
import { useAuth } from './lib/useAuth';
import { useOnlineStatus } from './lib/useOnlineStatus';
import { WifiOff } from 'lucide-react';
import './App.css';

function App() {
  const { user, loading } = useAuth();
  const isOnline = useOnlineStatus();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        <p>Starting SMRT...</p>
      </div>
    );
  }

  const userId = user?.id ?? '';

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        userId={userId}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
        {!isOnline && (
          <div className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
            <WifiOff size={14} />
            You're offline — using cached history
          </div>
        )}
        <InstallButton />
        <KnowledgePackUpload userId={userId} />
        <ResearchQueueForm userId={userId} />
        <ResearchQueueList userId={userId} />
        <ChatWindow
          userId={userId}
          conversationId={activeConversationId}
          onNewConversation={setActiveConversationId}
        />
        <p className="text-center text-xs text-slate-400">Session: {userId.slice(0, 8) || 'none'}</p>
      </div>
    </div>
  );
}

export default App;