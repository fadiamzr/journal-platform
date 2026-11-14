import { redirect } from "@/i18n/routing";
import { api } from "@/lib/api";

export default async function CurrentIssueRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const issues = await api.listIssues();
  const current = issues[0];

  if (current) {
    redirect({ href: `/issues/${current.id}`, locale });
  } else {
    redirect({ href: "/issues", locale });
  }
}
