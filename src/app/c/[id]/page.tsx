import { notFound } from 'next/navigation';
import { Chat } from '@/components/Chat';
import { isValidChatId, loadMessages } from '@/lib/chat-store';
import { getOwnerId } from '@/lib/owner';

/** A saved research session, loaded from the database on the server. */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await getOwnerId();
  if (!isValidChatId(id) || !ownerId) notFound();
  // null: the chat belongs to another browser, so show a 404 rather than their research.
  const initialMessages = await loadMessages(id, ownerId);
  if (!initialMessages) notFound();
  // key: switching sessions mounts a fresh useChat instead of reusing the previous one's state.
  return <Chat key={id} id={id} initialMessages={initialMessages} />;
}
