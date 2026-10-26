import { generateId } from 'ai';
import { connection } from 'next/server';
import { Chat } from '@/components/Chat';

/** A new research session. Its URL becomes /c/{id} once the first question is sent. */
export default async function Home() {
  // Render per request so every visitor gets their own id (not one baked in at build time).
  await connection();
  return <Chat id={generateId()} />;
}
