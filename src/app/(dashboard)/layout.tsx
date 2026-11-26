import type { ReactNode } from "react";
import { Topbar } from "@/components/dashboard/topbar";
import { ToastProvider } from "@/components/ui/toast";
import { requireAuth } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireAuth();

  return (
    <ToastProvider>
      <div className="flex min-h-full flex-1 flex-col bg-[#09090b]">
        <Topbar user={user} />
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 sm:px-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
