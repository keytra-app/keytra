export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-xs break-words text-red-300"
    >
      {children}
    </p>
  );
}
