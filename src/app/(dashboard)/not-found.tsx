import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
      <p className="font-mono text-xs text-zinc-500">404</p>
      <h1 className="text-base font-medium text-zinc-100">Ressource nicht gefunden</h1>
      <p className="max-w-xs text-xs text-zinc-500">
        Das angeforderte Projekt existiert nicht oder wurde gelöscht.
      </p>
      <Link href="/" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-2" })}>
        Zur Projektübersicht
      </Link>
    </div>
  );
}
