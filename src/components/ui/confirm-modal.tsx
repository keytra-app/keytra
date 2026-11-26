"use client";

import { Button } from "./button";
import { Modal, ModalActions } from "./modal";

/** Destructive confirmation. Closing is blocked while the action runs. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  pendingLabel,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title={title}
      description={description}
    >
      <ModalActions>
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Abbrechen
        </Button>
        <Button variant="danger-solid" onClick={onConfirm} disabled={pending}>
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </ModalActions>
    </Modal>
  );
}
