import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data: users, error } = await supabaseAdmin.from('Users').select('*');
  console.log('--- public.Users ---');
  if (error) console.error(error);
  else console.table(users.map(u => ({ id: u.id, username: u.Username, email: u.Email })));

  const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  console.log('\n--- auth.users ---');
  if (authError) console.error(authError);
  else console.table(authUsers.users.map(u => ({ id: u.id, email: u.email })));
}

run();
