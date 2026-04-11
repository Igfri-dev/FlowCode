import { AppHeader } from "@/components/ui/AppHeader";
import { FlowWorkspace } from "@/features/flow/components/FlowWorkspace";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-950">
      <AppHeader />

      <main className="flex flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <FlowWorkspace />
      </main>
    </div>
  );
}
