'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Settings, MessageSquare, Tag, User, UserPlus, Key } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { TagManager } from '@/components/settings/tag-manager';
import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';
import { InviteManager } from '@/components/settings/invite-manager';
import { LicenseManager } from '@/components/settings/license-manager';
import { authClient } from '@/lib/auth/client';

const TAB_VALUES = ['profile', 'whatsapp', 'templates', 'tags', 'convites', 'licencas'] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null): v is TabValue {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSystemOwner, setIsSystemOwner] = useState(false);

  const queryTab = searchParams.get('tab');
  const tab: TabValue = isTabValue(queryTab) ? queryTab : 'profile';

  const onChange = (next: TabValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    async function checkRole() {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        if (data?.isSuperAdmin) setIsSuperAdmin(true);
        if (data?.isSystemOwner) setIsSystemOwner(true);
      }
    }
    checkRole();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-slate-400 mt-1">
          Gerencie seu perfil, integração com o WhatsApp®, modelos de mensagens e tags.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => onChange(v as TabValue)}>
        <TabsList className="bg-slate-900 border border-slate-700 flex-wrap h-auto gap-1">
          <TabsTrigger
            value="profile"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <User className="size-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger
            value="whatsapp"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <Settings className="size-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <MessageSquare className="size-4" />
            Modelos
          </TabsTrigger>
          <TabsTrigger
            value="tags"
            className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
          >
            <Tag className="size-4" />
            Tags
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger
              value="convites"
              className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
            >
              <UserPlus className="size-4" />
              Convites
            </TabsTrigger>
          )}
          {isSystemOwner && (
            <TabsTrigger
              value="licencas"
              className="data-active:bg-slate-800 data-active:text-violet-400 text-slate-400"
            >
              <Key className="size-4" />
              Licenças OEM
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileForm />
          <PasswordForm />
          <SessionsCard />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppConfig />
        </TabsContent>

        <TabsContent value="templates">
          <TemplateManager />
        </TabsContent>

        <TabsContent value="tags">
          <TagManager />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="convites">
            <InviteManager />
          </TabsContent>
        )}
        {isSystemOwner && (
          <TabsContent value="licencas">
            <LicenseManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
