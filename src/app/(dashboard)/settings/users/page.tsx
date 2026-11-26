import { InvitesPanel } from "@/components/settings/invites-panel";
import { UsersPanel } from "@/components/settings/users-panel";
import { requireAdmin } from "@/lib/auth/session";
import { getUsersAndOpenInvites } from "@/lib/users/queries";

export default async function UsersSettingsPage() {
  const admin = await requireAdmin();
  const { users, invites } = await getUsersAndOpenInvites();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Team & Einladungen</h1>
        <p className="text-xs text-zinc-400">
          Verwalte Benutzerkonten, Rollen und einmalige Einladungslinks.
        </p>
      </div>

      <UsersPanel users={users} currentUserId={admin.id} />

      <div className="border-t border-zinc-800/80 pt-6">
        <InvitesPanel invites={invites} />
      </div>
    </div>
  );
}
