"use client";

import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { DownloadIcon } from "@/components/ui/icons";
import { FieldLabel, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { LocaleProgress } from "@/lib/projects/queries";

type Props = {
  projectSlug: string;
  sourceLocale: string;
  locales: LocaleProgress[];
  namespaces: string[];
};

export function ExportModalButton(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <DownloadIcon className="h-3.5 w-3.5" />
        <span>Export</span>
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Export"
        description="Übersetzungen als JSON oder ZIP herunterladen."
      >
        <ExportForm {...props} />
      </Modal>
    </>
  );
}

function ExportForm({ projectSlug, sourceLocale, locales, namespaces }: Props) {
  const [format, setFormat] = useState("nested");
  const [fallback, setFallback] = useState("source");
  const [namespace, setNamespace] = useState(
    namespaces.includes("default") ? "default" : (namespaces[0] ?? "default"),
  );

  const href = (params: Record<string, string>) =>
    `/api/projects/${projectSlug}/export?${new URLSearchParams({ ...params, format, fallback })}`;

  const languages = [
    { code: sourceLocale, name: "Ausgangssprache" },
    ...locales.map(({ code, name }) => ({ code, name })),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="export-format">Format</FieldLabel>
          <Select id="export-format" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="nested">Verschachtelt</option>
            <option value="flat">Flach</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="export-fallback">Fallback</FieldLabel>
          <Select id="export-fallback" value={fallback} onChange={(e) => setFallback(e.target.value)}>
            <option value="source">Quellsprache</option>
            <option value="empty">Leer</option>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="export-namespace" hint="Für Einzel-Downloads">
          Namespace
        </FieldLabel>
        <Select id="export-namespace" mono value={namespace} onChange={(e) => setNamespace(e.target.value)}>
          {(namespaces.length ? namespaces : ["default"]).map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </Select>
      </div>

      <ul className="max-h-56 divide-y divide-zinc-800 overflow-y-auto rounded-md border border-zinc-800">
        {languages.map((l) => (
          <li key={l.code} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className="min-w-0 truncate text-zinc-400">
              <span className="mr-2 font-mono text-zinc-200">{l.code}</span>
              {l.name}
            </span>
            <a
              href={href({ locale: l.code, namespace })}
              download
              aria-label={`${l.code} als JSON laden`}
              className={buttonClasses({ size: "xs" })}
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              <span className="font-mono">.json</span>
            </a>
          </li>
        ))}
      </ul>

      <div className="flex justify-end border-t border-zinc-800/80 pt-4">
        <a href={href({ all: "true" })} download className={buttonClasses({ variant: "primary" })}>
          <DownloadIcon className="h-3.5 w-3.5" />
          <span>Alle als .zip laden</span>
        </a>
      </div>
    </div>
  );
}
