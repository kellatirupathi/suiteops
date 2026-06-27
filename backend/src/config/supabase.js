import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    '[supabase] FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
  );
}

// Server-side client using the service-role key. This bypasses RLS, so the
// key must NEVER be sent to the browser. All access is gated by our own JWT.
export const supabase = createClient(url || 'http://localhost', serviceKey || 'invalid', {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default supabase;
