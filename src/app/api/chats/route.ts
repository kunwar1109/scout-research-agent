import { listChats } from '@/lib/chat-store';
import { getOwnerId } from '@/lib/owner';

export async function GET() {
  // Reading the owner cookie also makes this run per request (never prerendered at build time).
  const ownerId = await getOwnerId();
  return Response.json({ chats: ownerId ? await listChats(ownerId) : [] });
}
