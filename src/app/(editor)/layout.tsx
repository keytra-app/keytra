import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { requireAuth } from "@/lib/auth/session";

export default async function EditorLayout({ children }: { children: ReactNode }) {
  await requireAuth();

  return <ToastProvider>{children}</ToastProvider>;
}
