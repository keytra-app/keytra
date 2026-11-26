"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { LinkIcon, TrashIcon, XIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createInvite, revokeInvite } from "@/lib/auth/actions";
import type { Role } from "@/lib/auth/session";
import type { OpenInviteRow } from "@/lib/users/queries";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function InvitesPanel({ invites }: { invites: OpenInviteRow[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [role, setRole] = useState<Role>("translator");
  const [generatedLink, setGeneratedLink] = useState<{ url: string; role: Role } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCreate, startCreateTransition] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const chosenRole = role;
    const fd = new FormData();
    fd.set("role", chosenRole);

    startCreateTransition(async () => {
      const result = await createInvite(undefined, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.link) {
        setGeneratedLink({ url: result.link, role: chosenRole });
        try {
          await navigator.clipboard.writeText(result.link);
          toast("Einladungslink erstellt und in die Zwischenablage kopiert.");
        } catch {
          toast("Einladungslink erstellt.");
        }
        router.refresh();
      }
    });
  }

  async function handleRevoke(inviteId: string) {
    setRevokingId(inviteId);
    await revokeInvite(inviteId);
    setRevokingId(null);
    toast("Einladung widerrufen.");
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium text-zinc-100">Einladungen</h2>
        <p className="text-xs text-zinc-500">
          Erstelle einen einmaligen Einladungslink (7 Tage gültig) ohne E-Mail-Versand.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-[#111113] p-4 space-y-4">
        <form onSubmit={handleCreate} className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="invite-role" className="text-xs text-zinc-400 shrink-0">
              Rolle
            </label>
            <Select
              id="invite-role"
              mono
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-40"
            >
              <option value="translator">translator</option>
              <option value="admin">admin</option>
            </Select>
          </div>

          <Button type="submit" variant="primary" size="md" disabled={pendingCreate}>
            <LinkIcon className="h-3.5 w-3.5" />
            <span>{pendingCreate ? "Erstelle Link …" : "Link erstellen & kopieren"}</span>
          </Button>
        </form>

        {error && (
          <p role="alert" className="text-xs text-red-400">
            {error}
          </p>
        )}

        {generatedLink && (
          <div className="rounded-md border border-emerald-900/70 bg-emerald-950/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-emerald-300">
                Einladungslink ({generatedLink.role}) erstellt
              </span>
              <button
                type="button"
                onClick={() => setGeneratedLink(null)}
                aria-label="Link ausblenden"
                className="rounded p-0.5 text-zinc-500 hover:text-zinc-200 cursor-pointer"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-[#09090b] px-3 py-2">
              <code className="truncate font-mono text-xs text-zinc-100 select-all">
                {generatedLink.url}
              </code>
              <CopyButton value={generatedLink.url} toastMessage="Einladungslink kopiert." />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-medium text-zinc-400">Offene Einladungen ({invites.length})</h3>

        {invites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-[#111113]/60 px-4 py-6 text-xs text-zinc-500">
            Keine offenen Einladungen vorhanden.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111113]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] text-zinc-500">
                  <th className="px-4 py-2.5 font-medium">Rolle</th>
                  <th className="px-4 py-2.5 font-medium">Erstellt von</th>
                  <th className="px-4 py-2.5 font-medium">Erstellt am</th>
                  <th className="px-4 py-2.5 font-medium">Gültig bis</th>
                  <th className="px-4 py-2.5 text-right font-medium">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {invites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-zinc-900/40">
                    <td className="px-4 py-2.5">
                      <Badge mono>{invite.role}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-300">{invite.creatorName}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{formatDateTime(invite.createdAt)}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{formatDateTime(invite.expiresAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="danger"
                        size="xs"
                        disabled={revokingId === invite.id}
                        onClick={() => handleRevoke(invite.id)}
                      >
                        <TrashIcon className="h-3 w-3" />
                        <span>{revokingId === invite.id ? "Widerrufe …" : "Widerrufen"}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
