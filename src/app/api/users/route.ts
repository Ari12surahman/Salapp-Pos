import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const cleanUsername = payload.username.trim();
    const email = `${cleanUsername.toLowerCase().replace(/\s/g, '')}@sistemkeuangan.com`;

    // 1. Create user using Admin API (bypasses rate limit and confirmation)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: payload.password,
      email_confirm: true // bypass confirmation
    });

    if (authError) {
      return NextResponse.json({ status: 'error', message: authError.message });
    }

    // 2. Insert into public.Users
    const newId = authData?.user?.id || ("U" + new Date().getTime());
    const { error: dbError } = await supabaseAdmin.from('Users').insert({
      id: newId, 
      Username: payload.username, 
      Name: payload.name, 
      Role: payload.role, 
      WarungID: payload.warungId, 
      Email: email
    });

    if (dbError) {
      // Rollback auth user creation if DB insert fails
      if (authData?.user?.id) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      }
      return NextResponse.json({ status: 'error', message: dbError.message });
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    const { id, username, name, role, warungId, password } = payload;

    // 1. Update public.Users table
    const { error: dbError } = await supabaseAdmin.from('Users').update({
      Username: username,
      Name: name,
      Role: role,
      WarungID: warungId
    }).eq('id', id);

    if (dbError) {
      return NextResponse.json({ status: 'error', message: dbError.message });
    }

    // 2. If a new password is provided, update it in Supabase Auth
    if (password && password.trim() !== '') {
      // Find real auth user id by email
      const { data: userData } = await supabaseAdmin.from('Users').select('Email').eq('id', id).single();
      const userEmail = userData?.Email;

      let authUserId = id;
      if (userEmail) {
        const prefix = userEmail.split('@')[0].toLowerCase();
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
        
        let matchedUser = authList?.users.find(u => u.email === userEmail);
        if (!matchedUser) {
          matchedUser = authList?.users.find(u => u.email?.startsWith(prefix + '@'));
        }

        if (matchedUser) {
          authUserId = matchedUser.id;
          
          // Auto-heal: sync email to auth.users so they match exactly
          if (matchedUser.email !== userEmail) {
            await supabaseAdmin.auth.admin.updateUserById(authUserId, { email: userEmail, email_confirm: true });
          }
        }
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: password
      });
      
      if (authError) {
        return NextResponse.json({ status: 'error', message: "Profil tersimpan tapi gagal ganti password: " + authError.message });
      }
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message });
  }
}
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ status: 'error', message: 'ID is required' });
    }

    // Optional: Get true Auth ID if mismatched (though typically delete by email or assume ID matches)
    const { data: userData } = await supabaseAdmin.from('Users').select('Email').eq('id', id).single();
    const userEmail = userData?.Email;

    let authUserId = id;
    if (userEmail) {
      const prefix = userEmail.split('@')[0].toLowerCase();
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
      
      let matchedUser = authList?.users.find(u => u.email === userEmail);
      if (!matchedUser) {
        matchedUser = authList?.users.find(u => u.email?.startsWith(prefix + '@'));
      }
      if (matchedUser) authUserId = matchedUser.id;
    }

    // 1. Delete from Auth Users
    await supabaseAdmin.auth.admin.deleteUser(authUserId);

    // 2. Delete from public.Users
    const { error: dbError } = await supabaseAdmin.from('Users').delete().eq('id', id);

    if (dbError) {
      return NextResponse.json({ status: 'error', message: dbError.message });
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message });
  }
}

