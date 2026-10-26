import { neon } from '@neondatabase/serverless';

/**
 * Neon's HTTP driver: each query is one HTTPS request, so there is no connection
 * pool to manage in serverless functions. Null when DATABASE_URL is unset, in
 * which case Scout still works but forgets everything on refresh.
 */
export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
