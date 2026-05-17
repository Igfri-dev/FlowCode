"use client";

import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { AdminSubmission } from "@/lib/admin-data";
import type { SessionUser } from "@/lib/auth";

export function StudentSubmissionsClient({
  submissions,
  user,
}: {
  submissions: AdminSubmission[];
  user: SessionUser;
}) {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-6 text-neutral-950 lg:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Student panel</p>
          <h1 className="text-3xl font-semibold">My submissions</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {user.fullName} ({user.username})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={secondaryButtonClassName} href="/">
            Open editor
          </Link>
          <form action={logoutAction}>
            <button className={primaryButtonClassName}>Sign out</button>
          </form>
        </div>
      </header>

      <section className="mt-5 overflow-hidden rounded-lg border border-neutral-300/80 bg-white shadow-md shadow-neutral-200/70">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/80 px-4 py-3">
          <h2 className="text-lg font-semibold">Submissions</h2>
          <span className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs font-semibold text-neutral-600">
            {submissions.length}
          </span>
        </div>
        <div className="overflow-x-hidden">
          <table className="w-full table-fixed text-left text-sm">
            <tbody>
              {submissions.length > 0 ? (
                submissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className="border-t border-neutral-200 transition hover:bg-emerald-50/40"
                  >
                    <td className={tableCellClassName}>
                      <span className="font-medium">{submission.title}</span>
                      <span className="block text-xs text-neutral-500">
                        {submission.exerciseTitle ?? "Free submission"}
                      </span>
                    </td>
                    <td className={tableCellClassName}>
                      {submission.submittedAt}
                    </td>
                    <td className={tableCellClassName}>
                      <StatusBadge status={submission.status} />
                      <span className="mt-1 block text-xs text-neutral-500">
                        {submission.testPassed === null
                          ? "No tests"
                          : submission.testPassed
                            ? "Tests passed"
                            : "Tests failed"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-4 text-neutral-500">
                    You have not submitted work yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "approved"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : status === "incomplete"
        ? "border-yellow-300 bg-yellow-50 text-yellow-900"
        : status === "rejected"
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-neutral-300 bg-neutral-50 text-neutral-700";

  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      {status}
    </span>
  );
}

const tableCellClassName = "break-words px-3 py-2 align-top";

const primaryButtonClassName =
  "rounded-md border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0";

const secondaryButtonClassName =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0";
