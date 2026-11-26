"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import type { Role } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { deleteUserAction, updateUserRoleAction } from "@/lib/users/actions";
import type { UserListRow } from "@/lib/users/queries";
import { RoleSelect } from "./role-select";

export function UsersPanel({
  users,
  currentUserId,
}: {
  users: UserListRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserListRow | null>(null);
  const [pendingDelete, startDeleteTransition] = useTransition();

  async function handleRoleChange(user: UserListRow, nextRole: Role) {
    if (user.id === currentUserId || user.role === nextRole) return;
    setUpdatingId(user.id);
    const result = await updateUserRoleAction(user.id, nextRole);
    setUpdatingId(null);

    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    toast(`Rolle von ${user.name} auf „${nextRole}“ geändert.`);
    router.refresh();
  }

  function handleConfirmDelete() {
    if (!userToDelete) return;
    const target = userToDelete;

    startDeleteTransition(async () => {
      const result = await deleteUserAction(target.id);
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast(`Account „${target.name}“ gelöscht.`);
      setUserToDelete(null);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium text-zinc-100">Benutzer ({users.length})</h2>
        <p className="text-xs text-zinc-500">
          Rollen können jederzeit umgeschaltet werden. Der eigene Account ist geschützt.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111113]">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-[11px] text-zinc-500">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">E-Mail</th>
              <th className="px-4 py-2.5 font-medium">Rolle</th>
              <th className="px-4 py-2.5 font-medium">Seit</th>
              <th className="px-4 py-2.5 text-right font-medium">Aktion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const isBusy = updatingId === user.id;

              return (
                <tr key={user.id} className="hover:bg-zinc-900/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100">{user.name}</span>
                      {isSelf && <Badge className="text-zinc-400">Du</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-zinc-400">{user.email}</td>
                  <td className="px-4 py-2.5">
                    {isSelf ? (
                      <Badge mono className="text-zinc-300">
                        {user.role}
                      </Badge>
                    ) : (
                      <RoleSelect
                        aria-label={`Rolle für ${user.name}`}
                        value={user.role}
                        disabled={isBusy}
                        onChange={(role) => handleRoleChange(user, role)}
                        className="h-7 w-32 py-0 text-xs"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {isSelf ? (
                      <span className="text-[11px] text-zinc-600">—</span>
                    ) : (
                      <Button
                        variant="danger"
                        size="xs"
                        onClick={() => setUserToDelete(user)}
                        aria-label={`${user.name} löschen`}
                      >
                        <TrashIcon className="h-3 w-3" />
                        <span>Löschen</span>
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Benutzer löschen"
        description={
          userToDelete
            ? `Der Account von ${userToDelete.name} (${userToDelete.email}) und alle aktiven Sitzungen werden sofort entfernt. Bestehende Übersetzungen bleiben erhalten.`
            : undefined
        }
        confirmLabel="Account löschen"
        pendingLabel="Lösche …"
        pending={pendingDelete}
      />
    </section>
  );
}
