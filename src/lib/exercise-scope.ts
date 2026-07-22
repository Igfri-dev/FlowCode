import type { SessionUser } from "@/lib/auth";

type ExerciseScopeViewer = Pick<SessionUser, "role" | "organizationId">;

export function getExerciseCreationOrganizationId(
  viewer: ExerciseScopeViewer,
): number | null | undefined {
  if (viewer.role === "admin") {
    return null;
  }

  if (viewer.role === "teacher" && viewer.organizationId) {
    return viewer.organizationId;
  }

  return undefined;
}

export function canManageExerciseScope(
  viewer: ExerciseScopeViewer,
  organizationId: number | null,
) {
  return (
    viewer.role === "admin" ||
    (viewer.role === "teacher" &&
      organizationId !== null &&
      organizationId === viewer.organizationId)
  );
}

export function getExerciseScope(organizationId: number | null) {
  return organizationId === null ? "global" : "organization";
}
