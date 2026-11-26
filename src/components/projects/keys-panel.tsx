"use client";

import { useState } from "react";
import { CreateKeyButton, type KeyProject } from "@/components/keys/create-key-modal";
import { DeleteKeyModal, EditKeyModal } from "@/components/keys/key-modals";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "@/components/ui/icons";
import { Input, Select } from "@/components/ui/input";
import type { SourceKey } from "@/lib/editor/queries";

// Real namespaces are never empty, so "" is free to mean "all".
const ALL = "";

export function KeysPanel({ project, keys }: { project: KeyProject; keys: SourceKey[] }) {
  const [query, setQuery] = useState("");
  const [selectedNamespace, setSelectedNamespace] = useState(ALL);
  const [editingKey, setEditingKey] = useState<SourceKey | null>(null);
  const [deletingKey, setDeletingKey] = useState<SourceKey | null>(null);

  // Falls back to "all" once the last key of the selected namespace is deleted.
  const namespace = project.namespaces.includes(selectedNamespace) ? selectedNamespace : ALL;
  const q = query.trim().toLowerCase();
  // shortcut: renders every key client-side; paginate or virtualize once projects reach thousands of keys.
  const visible = keys.filter(
    (k) =>
      (namespace === ALL || k.namespace === namespace) &&
      (!q || [k.key, k.sourceValue, k.description ?? ""].some((v) => v.toLowerCase().includes(q))),
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-medium text-zinc-100">Source-Keys</h2>
          <p className="text-xs text-zinc-500">
            {visible.length} von {keys.length} Keys
          </p>
        </div>
        <CreateKeyButton projects={[project]} defaultNamespace={namespace || undefined} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          aria-label="Keys durchsuchen"
          placeholder="Key, Quelltext oder Beschreibung suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-48 flex-1"
        />
        <div className="w-full sm:w-56">
          <Select
            aria-label="Namespace filtern"
            mono
            value={namespace}
            onChange={(e) => setSelectedNamespace(e.target.value)}
          >
            <option value={ALL}>Alle Namespaces</option>
            {project.namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 bg-[#111113]/60 px-6 py-12 text-center text-xs text-zinc-500">
          {keys.length === 0 ? "Noch keine Keys im Projekt." : "Keine Keys passen zum Filter."}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800/70 rounded-lg border border-zinc-800 bg-[#111113]">
          {visible.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-xs text-zinc-100">{item.key}</span>
                  <span className="rounded border border-zinc-800 bg-[#09090b] px-1.5 py-0.5 font-mono text-[11px] text-zinc-500">
                    {item.namespace}
                  </span>
                </div>
                <p className="line-clamp-2 break-words text-xs text-zinc-300">{item.sourceValue}</p>
                {item.description && (
                  <p className="line-clamp-1 break-words text-[11px] text-zinc-500">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="xs" onClick={() => setEditingKey(item)}>
                  Bearbeiten
                </Button>
                <Button
                  variant="danger"
                  size="xs"
                  aria-label={`Key ${item.key} löschen`}
                  onClick={() => setDeletingKey(item)}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* The actions revalidate this route, so the list updates through its props. */}
      {editingKey && (
        <EditKeyModal
          key={editingKey.id}
          item={editingKey}
          onClose={() => setEditingKey(null)}
          projectId={project.id}
          sourceLocale={project.sourceLocale}
        />
      )}
      <DeleteKeyModal
        item={deletingKey}
        onClose={() => setDeletingKey(null)}
        projectId={project.id}
      />
    </section>
  );
}
