import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { loginAction } from "@/lib/auth/actions";
import { getCurrentUser, hasAnyUsers } from "@/lib/auth/session";

export default async function LoginPage() {
  if (!(await hasAnyUsers())) redirect("/setup");
  if (await getCurrentUser()) redirect("/");

  return (
    <AuthForm
      title="Anmelden"
      action={loginAction}
      fields={["email", "password"]}
      submitLabel="Anmelden"
    />
  );
}
