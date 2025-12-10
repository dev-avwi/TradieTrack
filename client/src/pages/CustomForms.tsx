import { CustomFormsPage } from "@/components/CustomFormBuilder";
import { PageShell } from "@/components/ui/page-shell";

export default function CustomForms() {
  return (
    <PageShell title="Custom Forms" description="Create and manage form templates">
      <CustomFormsPage />
    </PageShell>
  );
}
