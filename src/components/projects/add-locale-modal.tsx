"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FieldLabel, Input, Select } from "@/components/ui/input";
import { Modal, ModalActions } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { LocaleOption } from "@/lib/i18n/locales";
import { addLocaleAction } from "@/lib/projects/actions";

const CUSTOM_CODE = "__custom__";

/** Mount only while open: the form state starts fresh on every mount. */
export function AddLocaleModal({
  projectId,
  presets,
  onClose,
}: {
  projectId: string;
  presets: readonly LocaleOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [selectedCode, setSelectedCode] = useState(presets[0]?.code ?? CUSTOM_CODE);
  const [customCode, setCustomCode] = useState("");
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isCustom = selectedCode === CUSTOM_CODE;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await addLocaleAction({
        projectId,
        code: isCustom ? customCode.trim() : selectedCode,
        name: isCustom ? customName.trim() : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(`Sprache „${result.code}“ hinzugefügt.`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open
      onClose={() => !pending && onClose()}
      title="Sprache hinzufügen"
      description="Wähle einen ISO-Sprachcode oder gib einen eigenen BCP-47-Code ein."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="add-locale-select">Sprache</FieldLabel>
          <Select
            id="add-locale-select"
            mono
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
          >
            {presets.map((loc) => (
              <option key={loc.code} value={loc.code}>
                {loc.code} — {loc.name}
              </option>
            ))}
            <option value={CUSTOM_CODE}>Eigener Code …</option>
          </Select>
        </div>

        {isCustom && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="custom-locale-code">ISO / BCP-47 Code</FieldLabel>
              <Input
                id="custom-locale-code"
                mono
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="z. B. sv, de-AT"
                maxLength={20}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="custom-locale-name" hint="Optional">
                Anzeigename
              </FieldLabel>
              <Input
                id="custom-locale-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="z. B. Schwedisch"
                maxLength={64}
              />
            </div>
          </div>
        )}

        <FormError>{error}</FormError>

        <ModalActions>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Speichere …" : "Hinzufügen"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
