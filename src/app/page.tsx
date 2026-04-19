import { AppHeader } from "@/components/ui/AppHeader";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import { FlowWorkspace } from "@/features/flow/components/FlowWorkspace";

export default function Home() {
  return (
    <I18nProvider>
      <div className="flex min-h-screen flex-col bg-neutral-100 text-neutral-950">
        <AppHeader />

        <main className="flex flex-1 px-3 py-4 sm:px-4 lg:px-5 2xl:px-6">
          <FlowWorkspace />
        </main>
      </div>
    </I18nProvider>
  );
}
