import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit/audit';

// Helper to authenticate the caller and verify they are a Super Admin
async function verifySuperAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Não autorizado', status: 401 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile || !profile.is_super_admin || !profile.ativo) {
    return { error: 'Acesso Proibido. Exclusivo para Super Admin.', status: 403 };
  }

  return { user, profile };
}

// GET: Retrieve all users along with their permissions
export async function GET() {
  try {
    const authCheck = await verifySuperAdmin();
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const adminClient = createAdminClient();
    const { data: users, error } = await adminClient
      .from('profiles')
      .select('*, user_permissions(*)')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users });
  } catch (err) {
    console.error('[API Admin Users GET] error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST: Create a new user with modular permissions
export async function POST(request: Request) {
  try {
    const authCheck = await verifySuperAdmin();
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { user: callerUser, profile: callerProfile } = authCheck;
    const body = await request.json();
    const { name, email, password, permissions } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nome, Email e Senha são campos obrigatórios.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Create user in Supabase Auth using Admin SDK
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Falha ao criar credenciais de acesso.' }, { status: 500 });
    }

    const newAuthUser = authData.user;

    // 2. Fetch the automatically created profile (from on_auth_user_created trigger)
    let newProfile = null;
    let retries = 5;
    while (retries > 0 && !newProfile) {
      const { data } = await adminClient
        .from('profiles')
        .select('*')
        .eq('user_id', newAuthUser.id)
        .maybeSingle();

      if (data) {
        newProfile = data;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 500));
        retries--;
      }
    }

    if (!newProfile) {
      // Fallback: manually create profile if trigger execution is delayed
      const { data, error: profileError } = await adminClient
        .from('profiles')
        .insert({
          user_id: newAuthUser.id,
          full_name: name,
          email,
          is_super_admin: false,
          must_change_password: true,
          ativo: true,
        })
        .select()
        .single();

      if (profileError) {
        return NextResponse.json({ error: 'Erro ao criar perfil do usuário: ' + profileError.message }, { status: 500 });
      }
      newProfile = data;
    } else {
      // Update profile explicitly to ensure flags are set correctly
      await adminClient
        .from('profiles')
        .update({
          must_change_password: true,
          ativo: true,
        })
        .eq('id', newProfile.id);
    }

    // 3. Populate permissions
    if (permissions && typeof permissions === 'object') {
      const permissionRows = Object.keys(permissions).map((moduleName) => ({
        profile_id: newProfile.id,
        module_name: moduleName,
        can_view: !!permissions[moduleName].can_view,
        can_create: !!permissions[moduleName].can_create,
        can_edit: !!permissions[moduleName].can_edit,
        can_delete: !!permissions[moduleName].can_delete,
      }));

      if (permissionRows.length > 0) {
        const { error: permError } = await adminClient
          .from('user_permissions')
          .insert(permissionRows);

        if (permError) {
          console.error('[API Admin Users POST] permission insert error:', permError.message);
        }
      }
    }

    // 4. Log the action in Audit Logs
    await logAction(
      callerUser.id,
      callerProfile.full_name || callerUser.email || 'Admin',
      'criar_usuario',
      'Usuario',
      newProfile.id,
      `Criou o usuário ${name} (${email}) com permissões personalizadas.`
    );

    return NextResponse.json({ success: true, profileId: newProfile.id });
  } catch (err) {
    console.error('[API Admin Users POST] error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PUT: Update user profile & granular permissions
export async function PUT(request: Request) {
  try {
    const authCheck = await verifySuperAdmin();
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { user: callerUser, profile: callerProfile } = authCheck;
    const body = await request.json();
    const { id, full_name, ativo, permissions } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do perfil é obrigatório para atualização.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch existing user to verify super admin rules
    const { data: targetProfile, error: fetchError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !targetProfile) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    // Safety constraint: Cannot disable or modify the Super Admin
    if (targetProfile.is_super_admin) {
      if (ativo === false) {
        return NextResponse.json({ error: 'O Super Admin principal do CRM não pode ser desativado.' }, { status: 400 });
      }
    }

    // 1. Update Profile name & active status
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        full_name: full_name || targetProfile.full_name,
        ativo: typeof ativo === 'boolean' ? ativo : targetProfile.ativo,
      })
      .eq('id', id);

    if (profileError) {
      return NextResponse.json({ error: 'Erro ao atualizar dados cadastrais: ' + profileError.message }, { status: 500 });
    }

    // 2. Upsert Permissions
    if (permissions && typeof permissions === 'object') {
      const permissionRows = Object.keys(permissions).map((moduleName) => ({
        profile_id: id,
        module_name: moduleName,
        can_view: !!permissions[moduleName].can_view,
        can_create: !!permissions[moduleName].can_create,
        can_edit: !!permissions[moduleName].can_edit,
        can_delete: !!permissions[moduleName].can_delete,
      }));

      for (const row of permissionRows) {
        await adminClient
          .from('user_permissions')
          .upsert(row, { onConflict: 'profile_id,module_name' });
      }
    }

    // 3. Log action in Audit Logs
    await logAction(
      callerUser.id,
      callerProfile.full_name || callerUser.email || 'Admin',
      'editar_usuario',
      'Usuario',
      id,
      `Editou o perfil e permissões do usuário ${full_name || targetProfile.full_name} (${targetProfile.email}). Status ativo: ${ativo ?? targetProfile.ativo}.`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API Admin Users PUT] error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE: Terminate user access and delete account
export async function DELETE(request: Request) {
  try {
    const authCheck = await verifySuperAdmin();
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { user: callerUser, profile: callerProfile } = authCheck;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do perfil é obrigatório para exclusão.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch existing user to verify super admin rules
    const { data: targetProfile, error: fetchError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !targetProfile) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    // Safety constraint: Super Admin cannot be deleted
    if (targetProfile.is_super_admin) {
      return NextResponse.json({ error: 'O Super Admin principal do CRM não pode ser excluído.' }, { status: 400 });
    }

    // Delete user from Supabase Auth (automatically cascades profile and permissions delete)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetProfile.user_id);

    if (deleteError) {
      return NextResponse.json({ error: 'Erro ao remover credenciais de acesso: ' + deleteError.message }, { status: 500 });
    }

    // Log action in Audit Logs
    await logAction(
      callerUser.id,
      callerProfile.full_name || callerUser.email || 'Admin',
      'deletar_usuario',
      'Usuario',
      id,
      `Excluiu definitivamente a conta do usuário ${targetProfile.full_name} (${targetProfile.email}) do sistema.`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API Admin Users DELETE] error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
