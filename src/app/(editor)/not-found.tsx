import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function EditorNotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-[#09090b] px-6 text-center">
      <p className="font-mono text-xs text-zinc-500">404</p>
      <h1 className="text-base font-medium text-zinc-100">Editor nicht gefunden</h1>
      <p className="max-w-xs text-xs text-zinc-500">
        Das angeforderte Projekt oder die Zielsprache existiert nicht.
      </p>
      <Link
        href="/"
        className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-2" })}
      >
        Zur Projektübersicht
      </Link>
    </div>
  );
}
