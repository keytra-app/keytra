"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { CopyButton } from "@/components/ui/copy-button";
import { KeyIcon, PlusIcon, TrashIcon, XIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { createApiKeyAction, revokeApiKeyAction } from "@/lib/projects/actions";
import type { ProjectApiKeyRow } from "@/lib/projects/queries";
import { CiSnippets } from "./ci-snippets";

type CreatedKey = { name: string; key: string };

export function ApiCiPanel({
  projectId,
  projectSlug,
  sourceLocale,
  exampleTargetLocale,
  appUrl,
  apiKeys,
}: {
  projectId: string;
  projectSlug: string;
  sourceLocale: string;
  exampleTargetLocale: string;
  appUrl: string;
  apiKeys: ProjectApiKeyRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [keyName, setKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ProjectApiKeyRow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingCreate, startCreateTransition] = useTransition();
  const [pendingRevoke, startRevokeTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    startCreateTransition(async () => {
      const result = await createApiKeyAction({ projectId, name: keyName });
      if (!result.ok) {
        setCreateError(result.error);
        return;
      }
      setKeyName("");
      setCreatedKey({ name: result.name, key: result.key });
      toast(`API-Key „${result.name}“ erstellt.`);
      router.refresh();
    });
  }

  function handleConfirmRevoke() {
    if (!keyToRevoke) return;
    const target = keyToRevoke;

    startRevokeTransition(async () => {
      const result = await revokeApiKeyAction({ projectId, apiKeyId: target.id });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast(`API-Key „${target.name}“ widerrufen.`);
      setKeyToRevoke(null);
      router.refresh();
    });
  }

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-0.5">
          <h2 className="text-sm font-medium text-zinc-100">API-Keys</h2>
          <p className="text-xs text-zinc-500">
            Projektbezogene Bearer-Tokens für CI/CD-Push, Pull und Status-Abfragen.
          </p>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Name des Keys, z. B. GitHub Actions"
            maxLength={80}
            required
            className="sm:max-w-xs"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={pendingCreate}
            className="shrink-0"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>{pendingCreate ? "Erstelle …" : "API-Key erstellen"}</span>
          </Button>
        </form>

        {createError && (
          <p role="alert" className="text-xs text-red-400">
            {createError}
          </p>
        )}

        {createdKey && (
          <CreatedKeyNotice createdKey={createdKey} onDismiss={() => setCreatedKey(null)} />
        )}

        <ApiKeyTable apiKeys={apiKeys} onRevoke={setKeyToRevoke} />
      </div>

      <CiSnippets
        appUrl={appUrl}
        projectSlug={projectSlug}
        sourceLocale={sourceLocale}
        exampleTargetLocale={exampleTargetLocale}
      />

      <ConfirmModal
        open={Boolean(keyToRevoke)}
        onClose={() => setKeyToRevoke(null)}
        onConfirm={handleConfirmRevoke}
        title="API-Key widerrufen"
        description={
          keyToRevoke
            ? `Der Key „${keyToRevoke.name}“ (${keyToRevoke.keyPrefix}…) verliert sofort den Zugriff auf die API.`
            : undefined
        }
        confirmLabel="Key widerrufen"
        pendingLabel="Widerrufe …"
        pending={pendingRevoke}
      />
    </section>
  );
}

/** The plaintext key is only available right after creation. */
function CreatedKeyNotice({
  createdKey,
  onDismiss,
}: {
  createdKey: CreatedKey;
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-emerald-900/70 bg-emerald-950/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-emerald-300">
            API-Key „{createdKey.name}“ erstellt — wird nur einmal angezeigt
          </p>
          <p className="text-[11px] text-zinc-400">
            Kopiere den Schlüssel jetzt und speichere ihn sicher (z. B. als GitHub Secret). Nach dem
            Schließen ist der Klartext nicht mehr abrufbar.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Hinweis ausblenden"
          className="cursor-pointer rounded p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-[#09090b] px-3 py-2">
        <code className="truncate font-mono text-xs text-zinc-100 select-all">
          {createdKey.key}
        </code>
        <CopyButton value={createdKey.key} toastMessage="API-Key kopiert." />
      </div>
    </div>
  );
}

function ApiKeyTable({
  apiKeys,
  onRevoke,
}: {
  apiKeys: ProjectApiKeyRow[];
  onRevoke: (apiKey: ProjectApiKeyRow) => void;
}) {
  if (apiKeys.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-800 bg-[#111113]/60 px-4 py-6 text-xs text-zinc-500">
        <KeyIcon className="h-4 w-4 shrink-0 text-zinc-600" />
        <span>Noch keine API-Keys für dieses Projekt erstellt.</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#111113]">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-800 text-[11px] text-zinc-500">
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Präfix</th>
            <th className="px-4 py-2.5 font-medium">Zuletzt genutzt</th>
            <th className="px-4 py-2.5 text-right font-medium">Aktion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {apiKeys.map((apiKey) => (
            <tr key={apiKey.id} className="hover:bg-zinc-900/40">
              <td className="px-4 py-2.5 font-medium text-zinc-200">{apiKey.name}</td>
              <td className="px-4 py-2.5 font-mono text-zinc-400">{apiKey.keyPrefix}…</td>
              <td className="px-4 py-2.5 text-zinc-400">
                {apiKey.lastUsedAt ? formatDateTime(apiKey.lastUsedAt) : "Nie genutzt"}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button variant="danger" size="xs" onClick={() => onRevoke(apiKey)}>
                  <TrashIcon className="h-3 w-3" />
                  <span>Widerrufen</span>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
