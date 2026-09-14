import type { ChatMessage } from '../types';

type Props = {
  messages: ChatMessage[];
};

export default function MessageList({ messages }: Props) {
  return (
    <div className="message-list">
      {messages.map((msg) => (
        <div key={msg.id} className={`message ${msg.role}`}>
          <span className="role-label">{msg.role === 'user' ? 'You' : 'SMRT'}</span>
          <p>{msg.content}</p>
        </div>
      ))}
    </div>
  );
}