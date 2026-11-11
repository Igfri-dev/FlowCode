type AdminIconName =
  | "submissions"
  | "users"
  | "exercises"
  | "organizations"
  | "editor"
  | "plus"
  | "upload"
  | "search"
  | "clock"
  | "check"
  | "attention";

const paths: Record<AdminIconName, React.ReactNode> = {
  submissions: (
    <>
      <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M8 11h8m-8 4h5" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      <circle cx="9" cy="7" r="4" />
    </>
  ),
  exercises: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v19H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 3Z" />
      <path d="M8 7h8m-8 4h5" />
    </>
  ),
  organizations: (
    <>
      <rect x="4" y="3" width="12" height="18" rx="2" />
      <path d="M16 9h4v12H4m4-14h4m-4 4h4m-4 4h4m-2 6v-2" />
    </>
  ),
  editor: (
    <>
      <rect x="3" y="3" width="7" height="6" rx="1.5" />
      <rect x="14" y="15" width="7" height="6" rx="1.5" />
      <path d="M6.5 9v9H14m3.5-3V6H10" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  attention: (
    <>
      <path d="m10.3 4-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4m0 4h.01" />
    </>
  ),
};

export function AdminIcon({
  name,
  className = "h-4 w-4",
}: {
  name: AdminIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
