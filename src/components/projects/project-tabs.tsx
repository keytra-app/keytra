"use client";

import { useState } from "react";
import { AccessPanel } from "@/components/projects/access-panel";
import { ApiCiPanel } from "@/components/projects/api-ci-panel";
import { DangerPanel } from "@/components/projects/danger-panel";
import { KeysPanel } from "@/components/projects/keys-panel";
import { LocalesPanel } from "@/components/projects/locales-panel";
import type { ProjectDetail } from "@/lib/projects/queries";

type TabKey = "locales" | "keys" | "access" | "api" | "danger";

const ADMIN_TABS: readonly { key: TabKey; label: string }[] = [
  { key: "locales", label: "Sprachen" },
  { key: "keys", label: "Keys" },
  { key: "access", label: "Zugriff" },
  { key: "api", label: "API & CI/CD" },
  { key: "danger", label: "Gefahrenzone" },
];

export function ProjectTabs({ detail }: { detail: ProjectDetail }) {
  const [activeTab, setActiveTab] = useState<TabKey>("locales");
  const { project, totalKeys, locales, adminData } = detail;
  const isAdmin = adminData !== null;

  const exampleTargetLocale = locales[0]?.code ?? (project.sourceLocale === "de" ? "en" : "de");

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div
          role="tablist"
          aria-label="Projektbereiche"
          className="flex items-center gap-1 border-b border-zinc-800"
        >
          {ADMIN_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? "text-zinc-100 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-zinc-100"
                    : tab.key === "danger"
                      ? "text-zinc-500 hover:text-red-400"
                      : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {(!isAdmin || activeTab === "locales") && (
        <LocalesPanel
          projectId={project.id}
          projectSlug={project.slug}
          sourceLocale={project.sourceLocale}
          totalKeys={totalKeys}
          locales={locales}
          isAdmin={isAdmin}
        />
      )}

      {isAdmin && activeTab === "keys" && (
        <KeysPanel project={{ ...project, namespaces: detail.namespaces }} keys={adminData.keys} />
      )}

      {isAdmin && activeTab === "access" && (
        <AccessPanel
          projectId={project.id}
          initialAccess={project.translatorAccess}
          translators={adminData.translators}
          initialMemberIds={adminData.memberIds}
        />
      )}

      {isAdmin && activeTab === "api" && (
        <ApiCiPanel
          projectId={project.id}
          projectSlug={project.slug}
          sourceLocale={project.sourceLocale}
          exampleTargetLocale={exampleTargetLocale}
          appUrl={adminData.appUrl}
          apiKeys={adminData.apiKeys}
        />
      )}

      {isAdmin && activeTab === "danger" && (
        <DangerPanel projectId={project.id} projectName={project.name} projectSlug={project.slug} />
      )}
    </div>
  );
}
