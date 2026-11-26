"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { COMMON_LOCALES, slugify } from "@/lib/i18n/locales";
import { createProjectAction } from "@/lib/projects/actions";

const CUSTOM_LOCALE_VALUE = "__custom__";

export function CreateProjectModalButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedLocale, setSelectedLocale] = useState("en");
  const [customLocale, setCustomLocale] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    setSelectedLocale("en");
    setCustomLocale("");
    setError(null);
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
    reset();
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const sourceLocale = selectedLocale === CUSTOM_LOCALE_VALUE ? customLocale.trim() : selectedLocale;

    startTransition(async () => {
      const result = await createProjectAction({
        name,
        slug,
        description,
        sourceLocale,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast(`Projekt „${result.slug}“ erstellt.`);
      setOpen(false);
      reset();
      router.push(`/projects/${result.slug}`);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="h-3.5 w-3.5" />
        <span>Neues Projekt</span>
      </Button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Neues Projekt"
        description="Lege ein neues Übersetzungsprojekt mit Ausgangssprache an."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="project-name">Name</FieldLabel>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="z. B. Web App"
              maxLength={100}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="project-slug" hint="URL & API-Pfad">
              Slug
            </FieldLabel>
            <Input
              id="project-slug"
              mono
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              placeholder="web-app"
              maxLength={64}
              required
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="project-source-locale">Ausgangssprache (Source-Locale)</FieldLabel>
            <Select
              id="project-source-locale"
              mono
              value={selectedLocale}
              onChange={(e) => setSelectedLocale(e.target.value)}
            >
              {COMMON_LOCALES.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.code} — {loc.name}
                </option>
              ))}
              <option value={CUSTOM_LOCALE_VALUE}>Eigener ISO-Code …</option>
            </Select>
            {selectedLocale === CUSTOM_LOCALE_VALUE && (
              <Input
                mono
                value={customLocale}
                onChange={(e) => setCustomLocale(e.target.value)}
                placeholder="z. B. de-CH, en-GB"
                maxLength={20}
                required
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <FieldLabel htmlFor="project-description" hint="Optional">
              Beschreibung
            </FieldLabel>
            <Textarea
              id="project-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurze Notiz zum Projekt oder Repository"
              maxLength={500}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-zinc-800/80 pt-4">
            <Button variant="ghost" onClick={handleClose} disabled={pending}>
              Abbrechen
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Erstelle …" : "Projekt anlegen"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
