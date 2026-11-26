import { AuthForm } from "@/components/auth-form";
import { findOpenInviteRole } from "@/lib/auth/accounts";
import { acceptInviteAction } from "@/lib/auth/actions";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const role = await findOpenInviteRole(token);

  if (!role) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-1 rounded-md border border-zinc-800 p-6">
          <h1 className="text-base font-medium text-zinc-100">Einladung ungültig</h1>
          <p className="text-sm text-zinc-500">
            Der Link ist abgelaufen, wurde widerrufen oder bereits genutzt.
          </p>
        </div>
      </main>
    );
  }

  return (
    <AuthForm
      title="Einladung annehmen"
      description={`Du wirst als ${role} angelegt.`}
      action={acceptInviteAction.bind(null, token)}
      fields={["name", "email", "new-password"]}
      submitLabel="Account erstellen"
    />
  );
}
