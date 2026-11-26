import { TranslationEditor } from "@/components/editor/translation-editor";
import { getEditorData } from "@/lib/editor/queries";

export default async function TranslateLocalePage({
  params,
}: PageProps<"/projects/[slug]/translate/[locale]">) {
  const { slug, locale } = await params;
  const data = await getEditorData(slug, decodeURIComponent(locale));

  return <TranslationEditor key={`${data.project.id}:${data.locale.id}`} data={data} />;
}
