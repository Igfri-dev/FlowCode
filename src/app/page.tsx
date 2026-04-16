import { AppHeader } from "@/components/ui/AppHeader";
import { FlowWorkspace } from "@/features/flow/components/FlowWorkspace";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-100 text-neutral-950">
      <AppHeader />

      <main className="flex flex-1 px-3 py-4 sm:px-4 lg:px-5 2xl:px-6">
        <FlowWorkspace />
      </main>
    </div>
  );
}
