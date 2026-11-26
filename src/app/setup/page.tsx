import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { setupAction } from "@/lib/auth/actions";
import { getCurrentUser, hasAnyUsers } from "@/lib/auth/session";

export default async function SetupPage() {
  if (await hasAnyUsers()) redirect((await getCurrentUser()) ? "/" : "/login");

  return (
    <AuthForm
      title="Keytra einrichten"
      description="Lege den ersten Admin-Account an."
      action={setupAction}
      fields={["name", "email", "new-password"]}
      submitLabel="Admin anlegen"
    />
  );
}
