import { CopyButton } from "@/components/ui/copy-button";

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[#111113]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3.5 py-2">
        <span className="text-xs font-medium text-zinc-300">{title}</span>
        <CopyButton value={code} toastMessage={`${title} kopiert.`} />
      </div>
      <pre className="overflow-x-auto bg-[#09090b] p-3.5 font-mono text-[11px] leading-relaxed text-zinc-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Ready-to-paste push/pull commands and a GitHub workflow for this project. */
export function CiSnippets({
  appUrl,
  projectSlug,
  sourceLocale,
  exampleTargetLocale,
}: {
  appUrl: string;
  projectSlug: string;
  sourceLocale: string;
  exampleTargetLocale: string;
}) {
  const pushUrl = `${appUrl}/api/v1/projects/${projectSlug}/push`;
  const pullUrl = `${appUrl}/api/v1/projects/${projectSlug}/pull/${exampleTargetLocale}`;

  const pushSnippet = `curl -fsSL -X POST "${pushUrl}" \\
  -H "Authorization: Bearer $KEYTRA_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data-binary @locales/${sourceLocale}.json`;

  const pullSnippet = `curl -fsSL "${pullUrl}" \\
  -H "Authorization: Bearer $KEYTRA_API_KEY" \\
  -o locales/${exampleTargetLocale}.json`;

  const githubActionYaml = `name: Keytra Push
on:
  push:
    branches: [master]
    paths: ["locales/${sourceLocale}.json"]
jobs:
  push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: curl -fsSL -X POST "${pushUrl}" -H "Authorization: Bearer \${{ secrets.KEYTRA_API_KEY }}" -H "Content-Type: application/json" --data-binary @locales/${sourceLocale}.json`;

  return (
    <div className="space-y-4 border-t border-zinc-800/80 pt-6">
      <div className="space-y-0.5">
        <h3 className="text-sm font-medium text-zinc-100">CI/CD-Snippets</h3>
        <p className="text-xs text-zinc-500">
          Sofort einsatzbereit für <span className="font-mono text-zinc-400">{projectSlug}</span>{" "}
          auf <span className="font-mono text-zinc-400">{appUrl}</span>.
        </p>
      </div>

      <div className="space-y-3">
        <CodeBlock title={`curl — Source-Keys pushen (${sourceLocale})`} code={pushSnippet} />
        <CodeBlock
          title={`curl — Übersetzungen pullen (${exampleTargetLocale})`}
          code={pullSnippet}
        />
        <CodeBlock title="GitHub Actions — .github/workflows/keytra.yml" code={githubActionYaml} />
      </div>
    </div>
  );
}
