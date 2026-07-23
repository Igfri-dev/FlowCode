"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
} from "@xyflow/react";
import {
  checkEmailAvailabilityAction,
  checkUsernameAvailabilityAction,
  logoutAction,
} from "@/app/actions/auth";
import {
  createExerciseAction,
  createOrganizationAction,
  createUserAction,
  createUserGroupAction,
  bulkCreateUsersAction,
  deleteExerciseAction,
  deleteUserAction,
  deleteUserGroupAction,
  deleteUserGroupWithUsersAction,
  manageSelectedUsersAction,
  retryPendingEmailsAction,
  updateExerciseAction,
  updateSubmissionReviewAction,
  updateUserEmailAction,
  updateUserOrganizationAction,
  type UserCreationState,
  type UserManagementState,
} from "@/app/admin/actions";
import { useI18n } from "@/features/i18n/I18nProvider";
import { flowEdgeComponents } from "@/components/editor/edges";
import { flowNodeComponents } from "@/features/flow/components/nodes";
import { FlowNodeRenderProvider } from "@/features/flow/components/nodes/FlowNodeRenderContext";
import { useAccountAvailability } from "@/hooks/useAccountAvailability";
import type { SessionUser } from "@/lib/auth";
import type {
  AdminExercise,
  AdminOrganization,
  AdminSubmission,
  AdminUser,
  AdminUserGroup,
} from "@/lib/admin-data";
import type { FlowEditorEdge, FlowEditorNode } from "@/types/flow";
import logoImage from "../logo.png";

type AdminChromeProps = {
  children: ReactNode;
  user: SessionUser;
};

type AdminUsersPageProps = {
  groups: AdminUserGroup[];
  organizations: AdminOrganization[];
  user: SessionUser;
  users: AdminUser[];
};

type AdminExercisesPageProps = {
  exercises: AdminExercise[];
  user: SessionUser;
};

type AdminOrganizationsPageProps = {
  organizations: AdminOrganization[];
  user: SessionUser;
};

type AdminSubmissionsPageProps = {
  submissions: AdminSubmission[];
  user: SessionUser;
};

const copy = {
  es: {
    eyebrow: "Panel",
    title: "Administracion de FlowCode",
    signedIn: "Sesion iniciada como",
    openEditor: "Abrir editor",
    signOut: "Cerrar sesion",
    createUser: "Crear usuario",
    createOrganization: "Crear organizacion",
    organizationName: "Nombre de la organizacion",
    organization: "Organizacion",
    organizations: "Organizaciones",
    organizationsHelp:
      "Crea espacios independientes para profesores, alumnos, ejercicios y entregas.",
    assignOrganization: "Asignar",
    selectOrganization: "Selecciona una organizacion",
    teachers: "Profesores",
    students: "Alumnos",
    adminGlobalAccess: "Los administradores tienen acceso global.",
    fullName: "Nombre completo",
    username: "Usuario",
    password: "Contrasena",
    email: "Correo electronico",
    passwordOptional: "Contraseña inicial (opcional)",
    passwordConfirmation: "Confirmar contraseña inicial",
    passwordHelp:
      "Si queda vacía, el servidor generará una contraseña temporal. En ambos casos deberá cambiarse al primer inicio.",
    passwordMatch: "Las contraseñas coinciden.",
    passwordMismatch: "Las contraseñas no coinciden.",
    usernameChecking: "Comprobando disponibilidad...",
    usernameCheckFailed: "No se pudo comprobar el nombre de usuario.",
    emailChecking: "Comprobando correo...",
    emailCheckFailed: "No se pudo comprobar el correo electrónico.",
    bulkUsers: "Carga masiva por CSV",
    bulkUsersHelp:
      "Columnas: nombre, usuario, contraseña, correo, tipo_de_usuario y organizacion.",
    selectCsv: "Seleccionar archivo CSV",
    uploadCsv: "Crear usuarios del CSV",
    downloadTemplate: "Descargar plantilla",
    retryEmails: "Reintentar correos pendientes",
    createExercise: "Crear ejercicio",
    newExercise: "Nuevo ejercicio",
    editExercise: "Editar ejercicio",
    saveChanges: "Guardar cambios",
    deleteExercise: "Eliminar",
    deleteExerciseConfirm:
      "¿Eliminar este ejercicio? Las entregas existentes se conservaran como entregas libres.",
    exerciseTitle: "Titulo",
    description: "Descripcion",
    objective: "Objetivo",
    starterCode:
      "JavaScript inicial opcional. Se guardara, pero no se mostrara como solucion en el importador.",
    testCases:
      'Tests en JSON. Ejemplo: [{"name":"caso 1","inputs":[5],"expectedOutputs":["10"]}]',
    submissionDeadline: "Fecha limite de entrega",
    submissionDeadlineHelp:
      "Opcional. Despues de esta fecha los alumnos no pueden entregar ni editar.",
    noDeadline: "Sin fecha limite",
    tags: "Etiquetas separadas por coma",
    users: "Usuarios",
    usersHelp: "Gestiona las cuentas de alumnos, profesores y administradores.",
    exercises: "Ejercicios",
    exercisesHelp:
      "El catálogo de la plataforma es global; los ejercicios de profesores pertenecen solo a su organización.",
    globalCatalog: "Catálogo global de la plataforma",
    globalExerciseHelp:
      "Este ejercicio estará disponible para todas las organizaciones sin crear copias.",
    organizationExerciseHelp:
      "Este ejercicio será privado para los alumnos y profesores de esta organización.",
    submissions: "Entregas",
    submissionsHelp: "Revisa diagramas enviados y ejecutalos para evaluarlos.",
    search: "Buscar por alumno, ejercicio o entrega",
    searchExercises: "Buscar ejercicios",
    allStudents: "Todos los alumnos",
    allOrganizations: "Todas las organizaciones",
    allExercises: "Todos los ejercicios",
    allStatuses: "Todos los estados",
    allTestResults: "Todos los tests",
    testPassedFilter: "Tests aprobados",
    testFailedFilter: "Tests fallidos",
    noTestFilter: "Sin tests",
    groupBy: "Agrupar por",
    noGrouping: "Sin agrupar",
    groupStudent: "Alumno",
    groupExercise: "Ejercicio",
    showing: "Mostrando",
    of: "de",
    blocks: "bloques",
    failedCases: "casos fallidos",
    awaitingReview: "Por revisar",
    needsWork: "Necesitan correccion",
    passed: "Aprobadas",
    submissionsCount: "entregas",
    edit: "Editar",
    createdBy: "Creado por",
    noMatchingRows: "No hay resultados para estos filtros.",
    correctionsSaved: "Correcciones guardadas",
    noRows: "Sin registros todavia.",
    freeSubmission: "Entrega libre",
    review: "Revisar",
    tests: "Tests",
    testsPassed: "Tests aprobados",
    testsFailed: "Tests fallidos",
    noTests: "Sin tests",
    languageToggle: "Cambiar idioma",
    activeRole: "Rol activo",
    total: "Total",
  },
  en: {
    eyebrow: "Panel",
    title: "FlowCode administration",
    signedIn: "Signed in as",
    openEditor: "Open editor",
    signOut: "Sign out",
    createUser: "Create user",
    createOrganization: "Create organization",
    organizationName: "Organization name",
    organization: "Organization",
    organizations: "Organizations",
    organizationsHelp:
      "Create isolated spaces for teachers, students, exercises, and submissions.",
    assignOrganization: "Assign",
    selectOrganization: "Select an organization",
    teachers: "Teachers",
    students: "Students",
    adminGlobalAccess: "Administrators have global access.",
    fullName: "Full name",
    username: "Username",
    password: "Password",
    email: "Email",
    passwordOptional: "Initial password (optional)",
    passwordConfirmation: "Confirm initial password",
    passwordHelp:
      "If empty, the server generates a temporary password. It must always be changed on first sign-in.",
    passwordMatch: "Passwords match.",
    passwordMismatch: "Passwords do not match.",
    usernameChecking: "Checking availability...",
    usernameCheckFailed: "Could not check username availability.",
    emailChecking: "Checking email...",
    emailCheckFailed: "Could not check email availability.",
    bulkUsers: "Bulk CSV upload",
    bulkUsersHelp:
      "Columns: nombre, usuario, contraseña, correo, tipo_de_usuario, and organizacion.",
    selectCsv: "Select CSV file",
    uploadCsv: "Create CSV users",
    downloadTemplate: "Download template",
    retryEmails: "Retry pending emails",
    createExercise: "Create exercise",
    newExercise: "New exercise",
    editExercise: "Edit exercise",
    saveChanges: "Save changes",
    deleteExercise: "Delete",
    deleteExerciseConfirm:
      "Delete this exercise? Existing submissions will be preserved as free submissions.",
    exerciseTitle: "Title",
    description: "Description",
    objective: "Objective",
    starterCode:
      "Optional starter JavaScript. It will be saved but not shown as the solution in the import panel.",
    testCases:
      'JSON tests. Example: [{"name":"case 1","inputs":[5],"expectedOutputs":["10"]}]',
    submissionDeadline: "Submission deadline",
    submissionDeadlineHelp:
      "Optional. After this time, students cannot submit or edit their work.",
    noDeadline: "No deadline",
    tags: "Tags separated by comma",
    users: "Users",
    usersHelp: "Manage student, teacher, and administrator accounts.",
    exercises: "Exercises",
    exercisesHelp:
      "The platform catalog is global; teacher exercises only belong to their organization.",
    globalCatalog: "Global platform catalog",
    globalExerciseHelp:
      "This exercise will be available to every organization without creating copies.",
    organizationExerciseHelp:
      "This exercise is private to the students and teachers in this organization.",
    submissions: "Submissions",
    submissionsHelp: "Review submitted diagrams and run them for evaluation.",
    search: "Search by student, exercise, or submission",
    searchExercises: "Search exercises",
    allStudents: "All students",
    allOrganizations: "All organizations",
    allExercises: "All exercises",
    allStatuses: "All statuses",
    allTestResults: "All test results",
    testPassedFilter: "Tests passed",
    testFailedFilter: "Tests failed",
    noTestFilter: "No tests",
    groupBy: "Group by",
    noGrouping: "No grouping",
    groupStudent: "Student",
    groupExercise: "Exercise",
    showing: "Showing",
    of: "of",
    blocks: "blocks",
    failedCases: "failed cases",
    awaitingReview: "Awaiting review",
    needsWork: "Needs correction",
    passed: "Approved",
    submissionsCount: "submissions",
    edit: "Edit",
    createdBy: "Created by",
    noMatchingRows: "No results match these filters.",
    correctionsSaved: "Corrections saved",
    noRows: "No records yet.",
    freeSubmission: "Free submission",
    review: "Review",
    tests: "Tests",
    testsPassed: "Tests passed",
    testsFailed: "Tests failed",
    noTests: "No tests",
    languageToggle: "Change language",
    activeRole: "Active role",
    total: "Total",
  },
} as const;

export function AdminUsersPage({
  groups,
  organizations,
  user,
  users,
}: AdminUsersPageProps) {
  const { language } = useI18n();
  const text = copy[language];
  const ui =
    language === "es"
      ? {
          active: "Activo",
          activate: "Activar",
          addToGroup: "Añadir al grupo",
          administrators: "Administradores",
          allGroups: "Todos los grupos",
          allRoles: "Todos los roles",
          course: "Curso",
          createGroup: "Crear grupo",
          custom: "Personalizado",
          deactivate: "Desactivar",
          delete: "Eliminar",
          deleteGroup: "Eliminar grupo",
          deleteGroupAndUsers: "Eliminar grupo y usuarios",
          deleteGroupConfirm:
            "¿Eliminar solo este grupo? Las cuentas de usuario se conservarán.",
          deleteGroupUsersConfirm:
            "¿Eliminar este grupo Y todas sus cuentas de usuario? También se borrarán sus sesiones, proyectos y entregas. Esta acción no se puede deshacer.",
          deleteSelectedConfirm:
            "¿Eliminar definitivamente las cuentas seleccionadas? También se borrarán sus sesiones, proyectos y entregas.",
          deleteUserConfirm:
            "¿Eliminar definitivamente esta cuenta y todos sus datos asociados?",
          filterUsers: "Buscar por nombre, usuario o correo",
          global: "Global",
          group: "Grupo",
          groupName: "Nombre del grupo",
          groups: "Grupos de usuarios",
          groupsHelp:
            "Crea cursos, conjuntos por organización o grupos personalizados y administra sus miembros con la selección múltiple.",
          inactive: "Inactivo",
          members: "miembros",
          organizationGroup: "Organización",
          removeFromGroup: "Quitar del grupo",
          selectAll: "Seleccionar visibles",
          selected: "seleccionados",
          selectMembers: "Seleccionar miembros",
          status: "Estado",
        }
      : {
          active: "Active",
          activate: "Activate",
          addToGroup: "Add to group",
          administrators: "Administrators",
          allGroups: "All groups",
          allRoles: "All roles",
          course: "Course",
          createGroup: "Create group",
          custom: "Custom",
          deactivate: "Deactivate",
          delete: "Delete",
          deleteGroup: "Delete group",
          deleteGroupAndUsers: "Delete group and users",
          deleteGroupConfirm:
            "Delete only this group? User accounts will be preserved.",
          deleteGroupUsersConfirm:
            "Delete this group AND all its user accounts? Their sessions, projects, and submissions will also be deleted. This cannot be undone.",
          deleteSelectedConfirm:
            "Permanently delete the selected accounts? Their sessions, projects, and submissions will also be deleted.",
          deleteUserConfirm:
            "Permanently delete this account and all associated data?",
          filterUsers: "Search by name, username, or email",
          global: "Global",
          group: "Group",
          groupName: "Group name",
          groups: "User groups",
          groupsHelp:
            "Create courses, organization sets, or custom groups and manage membership with multi-selection.",
          inactive: "Inactive",
          members: "members",
          organizationGroup: "Organization",
          removeFromGroup: "Remove from group",
          selectAll: "Select visible",
          selected: "selected",
          selectMembers: "Select members",
          status: "Status",
        };
  const [newUserRole, setNewUserRole] = useState("student");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [newGroupType, setNewGroupType] = useState("course");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [createState, createAction, createPending] = useActionState(
    createUserAction,
    {} as UserCreationState,
  );
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkCreateUsersAction,
    {} as UserCreationState,
  );
  const [groupState, groupAction, groupPending] = useActionState(
    createUserGroupAction,
    {} as UserManagementState,
  );
  const [managementState, managementAction, managementPending] =
    useActionState(
      manageSelectedUsersAction,
      {} as UserManagementState,
    );
  const csvTemplate = encodeURIComponent(
    "nombre,usuario,contraseña,correo,tipo_de_usuario,organizacion\nAna Pérez,ana.perez,,ana@example.com,student,Mi organización\n",
  );
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredUsers = useMemo(() => {
    const selectedGroup =
      groupFilter === "all"
        ? null
        : (groups.find((group) => group.id === Number(groupFilter)) ?? null);

    return users.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.fullName.toLocaleLowerCase().includes(normalizedQuery) ||
        item.username.toLocaleLowerCase().includes(normalizedQuery) ||
        (item.email ?? "").toLocaleLowerCase().includes(normalizedQuery);
      const matchesRole = roleFilter === "all" || item.role === roleFilter;
      const matchesGroup =
        selectedGroup === null || selectedGroup.memberIds.includes(item.id);

      return matchesQuery && matchesRole && matchesGroup;
    });
  }, [groupFilter, groups, normalizedQuery, roleFilter, users]);
  const selectableVisibleIds = filteredUsers
    .filter((item) => item.id !== user.id)
    .map((item) => item.id);
  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => selectedIds.includes(id));
  const activeSelectedIds = selectedIds.filter((id) =>
    users.some((item) => item.id === id && item.id !== user.id),
  );
  const selectedUserIds = activeSelectedIds.join(",");
  const normalizedNewUsername = newUsername.trim();
  const normalizedNewEmail = newEmail.trim().toLowerCase();
  const passwordMismatch = newPassword !== newPasswordConfirmation;
  const usernameCheck = useAccountAvailability({
    canCheck: Boolean(normalizedNewUsername),
    check: checkUsernameAvailabilityAction,
    failureMessage: text.usernameCheckFailed,
    value: normalizedNewUsername,
  });
  const emailCheck = useAccountAvailability({
    canCheck: Boolean(normalizedNewEmail),
    check: checkEmailAvailabilityAction,
    failureMessage: text.emailCheckFailed,
    value: normalizedNewEmail,
  });

  function toggleUser(userId: number) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function toggleVisibleUsers() {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !selectableVisibleIds.includes(id))
        : Array.from(new Set([...current, ...selectableVisibleIds])),
    );
  }

  return (
    <AdminChrome user={user}>
      <PageHeader count={users.length} help={text.usersHelp} title={text.users} />
      <section className={`${panelClassName} mb-4`}>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="max-w-xl">
            <PanelTitle>{ui.groups}</PanelTitle>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{ui.groupsHelp}</p>
          </div>
          <form
            action={groupAction}
            className="grid w-full gap-2 sm:grid-cols-2 lg:max-w-3xl lg:grid-cols-[minmax(160px,1fr)_150px_minmax(170px,1fr)_auto]"
          >
            <input
              className={inputClassName}
              name="name"
              placeholder={ui.groupName}
              required
            />
            <select
              className={inputClassName}
              name="type"
              value={newGroupType}
              onChange={(event) => setNewGroupType(event.target.value)}
            >
              <option value="course">{ui.course}</option>
              <option value="custom">{ui.custom}</option>
              {user.role === "admin" ? (
                <>
                  <option value="organization">{ui.organizationGroup}</option>
                  <option value="administrators">{ui.administrators}</option>
                </>
              ) : null}
            </select>
            {user.role === "admin" && newGroupType !== "administrators" ? (
              <select
                className={inputClassName}
                name="organizationId"
                defaultValue=""
              >
                <option value="">
                  {newGroupType === "custom" ? ui.global : text.selectOrganization}
                </option>
                {organizations
                  .filter((organization) => organization.isActive)
                  .map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
              </select>
            ) : (
              <input name="organizationId" type="hidden" value="" />
            )}
            <button className={primaryButtonClassName} disabled={groupPending}>
              {groupPending ? "…" : ui.createGroup}
            </button>
            <div className="sm:col-span-2 lg:col-span-4">
              <CreationMessage state={groupState} />
            </div>
          </form>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map((group) => (
            <article
              key={group.id}
              className="rounded-lg border border-neutral-200 bg-neutral-50/70 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-neutral-950">{group.name}</h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {groupTypeLabel(group.type, ui)} · {group.organizationName ?? ui.global}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-neutral-600 shadow-sm ring-1 ring-neutral-200">
                  {group.memberCount} {ui.members}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={`${secondaryButtonClassName} px-2.5 py-1.5 text-xs`}
                  type="button"
                  onClick={() => {
                    setSelectedIds(
                      group.memberIds.filter((memberId) => memberId !== user.id),
                    );
                    setGroupFilter(String(group.id));
                  }}
                >
                  {ui.selectMembers}
                </button>
                <form
                  action={deleteUserGroupAction}
                  onSubmit={(event) => {
                    if (!window.confirm(ui.deleteGroupConfirm)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input name="groupId" type="hidden" value={group.id} />
                  <button className={`${dangerButtonClassName} px-2.5 py-1.5 text-xs`}>
                    {ui.deleteGroup}
                  </button>
                </form>
                <form
                  action={deleteUserGroupWithUsersAction}
                  onSubmit={(event) => {
                    if (!window.confirm(ui.deleteGroupUsersConfirm)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input name="groupId" type="hidden" value={group.id} />
                  <button className={`${dangerButtonClassName} border-red-600 bg-red-600 px-2.5 py-1.5 text-xs text-white hover:bg-red-700`}>
                    {ui.deleteGroupAndUsers}
                  </button>
                </form>
              </div>
            </article>
          ))}
          {groups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-5 text-sm text-neutral-500">
              {text.noRows}
            </p>
          ) : null}
        </div>
      </section>

      <div className="grid w-full grid-cols-1 items-start gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className={`${panelClassName} xl:sticky xl:top-28`}>
          <PanelTitle>{text.createUser}</PanelTitle>
          <form action={createAction} className="mt-4 grid gap-3">
            <input
              name="fullName"
              placeholder={text.fullName}
              className={inputClassName}
              required
            />
            <input
              name="username"
              placeholder={text.username}
              className={inputClassName}
              value={newUsername}
              onBlur={usernameCheck.checkNow}
              onChange={(event) => setNewUsername(event.target.value)}
              aria-describedby="new-username-status"
              maxLength={80}
              required
            />
            <p
              id="new-username-status"
              aria-live="polite"
              className={`min-h-5 text-xs ${
                usernameCheck.availability?.available
                  ? "text-emerald-700"
                  : "text-red-700"
              }`}
            >
              {usernameCheck.pending
                ? text.usernameChecking
                : usernameCheck.availability?.message}
            </p>
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder={text.email}
              className={inputClassName}
              value={newEmail}
              onBlur={emailCheck.checkNow}
              onChange={(event) => setNewEmail(event.target.value)}
              aria-describedby="new-email-status"
              required
            />
            <p
              id="new-email-status"
              aria-live="polite"
              className={`min-h-5 text-xs ${
                emailCheck.availability?.available
                  ? "text-emerald-700"
                  : "text-red-700"
              }`}
            >
              {emailCheck.pending
                ? text.emailChecking
                : emailCheck.availability?.message}
            </p>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder={text.passwordOptional}
              className={inputClassName}
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <input
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              placeholder={text.passwordConfirmation}
              className={inputClassName}
              minLength={8}
              required={Boolean(newPassword)}
              value={newPasswordConfirmation}
              onChange={(event) =>
                setNewPasswordConfirmation(event.target.value)
              }
            />
            <p className="text-xs leading-5 text-neutral-600">
              {text.passwordHelp}
            </p>
            {newPassword || newPasswordConfirmation ? (
              <p
                aria-live="polite"
                className={`text-xs ${
                  passwordMismatch ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {passwordMismatch
                  ? text.passwordMismatch
                  : text.passwordMatch}
              </p>
            ) : null}
            {user.role === "admin" ? (
              <>
                <select
                  name="role"
                  className={inputClassName}
                  value={newUserRole}
                  onChange={(event) => setNewUserRole(event.target.value)}
                >
                  <option value="student">student</option>
                  <option value="teacher">teacher</option>
                  <option value="admin">admin</option>
                </select>
                {newUserRole !== "admin" ? (
                  <select
                    name="organizationId"
                    className={inputClassName}
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      {text.selectOrganization}
                    </option>
                    {organizations
                      .filter((organization) => organization.isActive)
                      .map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name} · {organization.studentCount}/60 alumnos
                        </option>
                      ))}
                  </select>
                ) : (
                  <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                    {text.adminGlobalAccess}
                  </p>
                )}
              </>
            ) : (
              <>
                <input name="role" type="hidden" value="student" />
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {text.organization}: {user.organizationName ?? "—"}
                </p>
                {(organizations.find(
                  (organization) => organization.id === user.organizationId,
                )?.studentCount ?? 0) >= 60 ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                    La organización alcanzó 60 alumnos. Contacta a contacto@igfri.dev para ampliar el cupo.
                  </p>
                ) : null}
              </>
            )}
            <CreationMessage state={createState} />
            <button
              className={primaryButtonClassName}
              disabled={
                createPending ||
                usernameCheck.pending ||
                emailCheck.pending ||
                Boolean(
                  normalizedNewUsername &&
                    !usernameCheck.availability?.available,
                ) ||
                Boolean(
                  normalizedNewEmail &&
                    !emailCheck.availability?.available,
                ) ||
                passwordMismatch
              }
            >
              {createPending ? "Creando..." : text.createUser}
            </button>
          </form>
          <div className="my-5 border-t border-neutral-200" />
          <PanelTitle>{text.bulkUsers}</PanelTitle>
          <p className="mt-3 text-xs leading-5 text-neutral-600">
            {text.bulkUsersHelp}
          </p>
          <form action={bulkAction} className="mt-3 grid gap-3">
            <label className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm font-semibold text-neutral-700 transition hover:border-emerald-400 hover:bg-emerald-50/40">
              {text.selectCsv}
              <input
                className="mt-2 block w-full text-xs font-normal file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:font-semibold file:text-white"
                type="file"
                name="csvFile"
                accept=".csv,text/csv"
                required
              />
            </label>
            <CreationMessage state={bulkState} />
            <button className={primaryButtonClassName} disabled={bulkPending}>
              {bulkPending ? "Procesando..." : text.uploadCsv}
            </button>
            <a
              className={`${secondaryButtonClassName} text-center`}
              href={`data:text/csv;charset=utf-8,${csvTemplate}`}
              download="plantilla-usuarios-flowcode.csv"
            >
              {text.downloadTemplate}
            </a>
          </form>
          {user.role === "admin" ? (
            <form action={retryPendingEmailsAction} className="mt-3">
              <button className={`${secondaryButtonClassName} w-full`}>
                {text.retryEmails}
              </button>
            </form>
          ) : null}
        </section>

        <AdminTable
          count={filteredUsers.length}
          emptyLabel={text.noMatchingRows}
          title={text.users}
          head={
            <tr className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <th className="w-12 px-3 py-2">
                <input
                  aria-label={ui.selectAll}
                  checked={allVisibleSelected}
                  className="h-4 w-4 accent-emerald-700"
                  onChange={toggleVisibleUsers}
                  type="checkbox"
                />
              </th>
              <th className="w-48 px-3 py-2">{text.fullName}</th>
              <th className="w-64 px-3 py-2">{text.email}</th>
              <th className="w-28 px-3 py-2">{text.activeRole}</th>
              <th className="w-64 px-3 py-2">{text.organization}</th>
              <th className="w-52 px-3 py-2">{ui.groups}</th>
              <th className="w-28 px-3 py-2" aria-label={ui.delete} />
            </tr>
          }
          toolbar={
            <div className="grid gap-3">
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  className={inputClassName}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={ui.filterUsers}
                  type="search"
                  value={searchQuery}
                />
                <select
                  className={inputClassName}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  value={roleFilter}
                >
                  <option value="all">{ui.allRoles}</option>
                  <option value="student">student</option>
                  <option value="teacher">teacher</option>
                  <option value="admin">admin</option>
                  <option value="independent">independent</option>
                </select>
                <select
                  className={inputClassName}
                  onChange={(event) => setGroupFilter(event.target.value)}
                  value={groupFilter}
                >
                  <option value="all">{ui.allGroups}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.memberCount})
                    </option>
                  ))}
                </select>
              </div>
              <form
                action={managementAction}
                className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3"
                onSubmit={(event) => {
                  const submitter = (event.nativeEvent as SubmitEvent)
                    .submitter as HTMLButtonElement | null;

                  if (
                    submitter?.value === "delete" &&
                    !window.confirm(ui.deleteSelectedConfirm)
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                <input name="userIds" type="hidden" value={selectedUserIds} />
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="mr-1 text-sm text-emerald-950">
                    {activeSelectedIds.length} {ui.selected}
                  </strong>
                  <button
                    className={`${secondaryButtonClassName} px-2.5 py-1.5 text-xs`}
                    disabled={managementPending || activeSelectedIds.length === 0}
                    name="operation"
                    value="activate"
                  >
                    {ui.activate}
                  </button>
                  <button
                    className={`${secondaryButtonClassName} px-2.5 py-1.5 text-xs`}
                    disabled={managementPending || activeSelectedIds.length === 0}
                    name="operation"
                    value="deactivate"
                  >
                    {ui.deactivate}
                  </button>
                  <select className={`${inputClassName} py-1.5 text-xs`} name="groupId" defaultValue="">
                    <option value="" disabled>{ui.group}</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                  <button
                    className={`${secondaryButtonClassName} px-2.5 py-1.5 text-xs`}
                    disabled={managementPending || activeSelectedIds.length === 0 || groups.length === 0}
                    name="operation"
                    value="addToGroup"
                  >
                    {ui.addToGroup}
                  </button>
                  <button
                    className={`${secondaryButtonClassName} px-2.5 py-1.5 text-xs`}
                    disabled={managementPending || activeSelectedIds.length === 0 || groups.length === 0}
                    name="operation"
                    value="removeFromGroup"
                  >
                    {ui.removeFromGroup}
                  </button>
                  {user.role === "admin" ? (
                    <>
                      <select className={`${inputClassName} py-1.5 text-xs`} name="organizationId" defaultValue="">
                        <option value="" disabled>{text.selectOrganization}</option>
                        {organizations.filter((organization) => organization.isActive).map((organization) => (
                          <option key={organization.id} value={organization.id}>{organization.name}</option>
                        ))}
                      </select>
                      <button
                        className={`${secondaryButtonClassName} px-2.5 py-1.5 text-xs`}
                        disabled={managementPending || activeSelectedIds.length === 0}
                        name="operation"
                        value="assignOrganization"
                      >
                        {text.assignOrganization}
                      </button>
                    </>
                  ) : null}
                  <button
                    className={`${dangerButtonClassName} ml-auto px-2.5 py-1.5 text-xs`}
                    disabled={managementPending || activeSelectedIds.length === 0}
                    name="operation"
                    value="delete"
                  >
                    {ui.delete}
                  </button>
                </div>
                <div className="mt-2">
                  <CreationMessage state={managementState} />
                </div>
              </form>
            </div>
          }
        >
          {filteredUsers.map((item) => {
            const itemGroups = groups.filter((group) =>
              group.memberIds.includes(item.id),
            );
            const isCurrentUser = item.id === user.id;

            return (
            <tr key={item.id} className={tableRowClassName}>
              <td className={tableCellClassName}>
                <input
                  aria-label={`${ui.selectMembers}: ${item.fullName}`}
                  checked={selectedIds.includes(item.id)}
                  className="h-4 w-4 accent-emerald-700"
                  disabled={isCurrentUser}
                  onChange={() => toggleUser(item.id)}
                  type="checkbox"
                />
              </td>
              <td className={tableCellClassName}>
                <p className="font-semibold text-neutral-900">{item.fullName}</p>
                <p className="mt-0.5 text-xs text-neutral-500">@{item.username}</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.isActive ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600"}`}>
                  {item.isActive ? ui.active : ui.inactive}
                </span>
              </td>
              <td className={`${tableCellClassName} text-xs`}>
                <form action={updateUserEmailAction} className="flex min-w-52 gap-2">
                  <input name="userId" type="hidden" value={item.id} />
                  <input
                    aria-label={`${text.email}: ${item.fullName}`}
                    className={`${inputClassName} min-w-0 flex-1 py-1.5 text-xs`}
                    name="email"
                    type="email"
                    defaultValue={item.email ?? ""}
                    placeholder={text.email}
                    required
                  />
                  <button className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold transition hover:border-emerald-400 hover:bg-emerald-50">
                    Guardar
                  </button>
                </form>
              </td>
              <td className={tableCellClassName}>
                <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-700">
                  {item.role}
                </span>
              </td>
              <td className={tableCellClassName}>
                {user.role === "admin" &&
                (item.role === "student" || item.role === "teacher") ? (
                  <form action={updateUserOrganizationAction} className="flex min-w-52 gap-2">
                    <input name="userId" type="hidden" value={item.id} />
                    <select
                      aria-label={`${text.organization}: ${item.fullName}`}
                      name="organizationId"
                      className={`${inputClassName} min-w-0 flex-1 py-1.5 text-xs`}
                      defaultValue={item.organizationId ?? ""}
                      required
                    >
                      <option value="" disabled>
                        {text.selectOrganization}
                      </option>
                      {organizations
                        .filter((organization) => organization.isActive)
                        .map((organization) => (
                          <option key={organization.id} value={organization.id}>
                            {organization.name} · {organization.studentCount}/60 alumnos
                          </option>
                        ))}
                    </select>
                    <button className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold transition hover:border-emerald-400 hover:bg-emerald-50">
                      {text.assignOrganization}
                    </button>
                  </form>
                ) : (
                  (item.organizationName ?? "Global")
                )}
              </td>
              <td className={tableCellClassName}>
                <div className="flex flex-wrap gap-1">
                  {itemGroups.map((group) => (
                    <span key={group.id} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                      {group.name}
                    </span>
                  ))}
                  {itemGroups.length === 0 ? <span className="text-xs text-neutral-400">—</span> : null}
                </div>
              </td>
              <td className={tableCellClassName}>
                {isCurrentUser ? (
                  <span className="text-xs text-neutral-400">{text.signedIn}</span>
                ) : (
                  <form
                    action={deleteUserAction}
                    onSubmit={(event) => {
                      if (!window.confirm(ui.deleteUserConfirm)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input name="userId" type="hidden" value={item.id} />
                    <button className={`${dangerButtonClassName} px-2.5 py-1.5 text-xs`}>
                      {ui.delete}
                    </button>
                  </form>
                )}
              </td>
            </tr>
            );
          })}
        </AdminTable>
      </div>
    </AdminChrome>
  );
}

export function AdminOrganizationsPage({
  organizations,
  user,
}: AdminOrganizationsPageProps) {
  const { language } = useI18n();
  const text = copy[language];

  return (
    <AdminChrome user={user}>
      <PageHeader
        count={organizations.length}
        help={text.organizationsHelp}
        title={text.organizations}
      />
      <div className="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className={`${panelClassName} xl:sticky xl:top-28`}>
          <PanelTitle>{text.createOrganization}</PanelTitle>
          <form action={createOrganizationAction} className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
              {text.organizationName}
              <input
                className={`${inputClassName} normal-case tracking-normal`}
                name="name"
                placeholder={text.organizationName}
                required
              />
            </label>
            <button className={primaryButtonClassName}>{text.createOrganization}</button>
          </form>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {organizations.length > 0 ? (
            organizations.map((organization) => (
              <article
                key={organization.id}
                className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                      #{organization.id}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{organization.name}</h2>
                    <p className="mt-0.5 text-xs text-neutral-500">{organization.slug}</p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    {organization.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <OrganizationMetric label={text.teachers} value={organization.teacherCount} />
                  <OrganizationMetric label={text.students} value={`${organization.studentCount}/60`} />
                  <OrganizationMetric label={text.exercises} value={organization.exerciseCount} />
                  <OrganizationMetric label={text.submissions} value={organization.submissionCount} />
                </div>
                {organization.studentCount >= 60 ? (
                  <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                    Cupo completo. Para ampliarlo, contacta a contacto@igfri.dev.
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyState label={text.noRows} />
          )}
        </section>
      </div>
    </AdminChrome>
  );
}

function OrganizationMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
      <span className="block font-semibold text-neutral-900">{value}</span>
      <span className="text-neutral-500">{label}</span>
    </div>
  );
}

export function AdminExercisesPage({
  exercises,
  user,
}: AdminExercisesPageProps) {
  const { language } = useI18n();
  const text = copy[language];
  const [query, setQuery] = useState("");
  const [editingExercise, setEditingExercise] = useState<AdminExercise | null>(
    null,
  );
  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return exercises;
    }

    return exercises.filter((exercise) =>
      [
        exercise.title,
        exercise.description,
        exercise.objective,
        exercise.tags,
        exercise.createdBy ?? "",
        exercise.organizationName ?? "",
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [exercises, query]);

  return (
    <AdminChrome user={user}>
      <PageHeader
        count={exercises.length}
        help={text.exercisesHelp}
        title={text.exercises}
      />
      <div className="grid w-full grid-cols-1 items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className={`${panelClassName} xl:sticky xl:top-28`}>
          <PanelTitle>{text.newExercise}</PanelTitle>
          <ExerciseForm
            action={createExerciseAction}
            submitLabel={text.createExercise}
            text={text}
            user={user}
          />
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{text.exercises}</h2>
                <p className="mt-0.5 text-sm text-neutral-500">
                  {text.showing} {filteredExercises.length} {text.of} {exercises.length}
                </p>
              </div>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.searchExercises}
                className={`${inputClassName} w-full sm:max-w-xs`}
              />
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 2xl:grid-cols-3">
            {filteredExercises.length > 0 ? (
              filteredExercises.map((exercise) => (
                <ExerciseCard
                  exercise={exercise}
                  key={`${exercise.organizationId}:${exercise.sourceId ?? exercise.id}`}
                  onEdit={
                    exercise.canManage
                      ? () => setEditingExercise(exercise)
                      : undefined
                  }
                  text={text}
                />
              ))
            ) : (
              <EmptyState label={exercises.length > 0 ? text.noMatchingRows : text.noRows} />
            )}
          </div>
        </section>
      </div>

      {editingExercise ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-950/55 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={text.editExercise}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditingExercise(null);
            }
          }}
        >
          <section className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {text.editExercise}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{editingExercise.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingExercise(null)}
                className={iconButtonClassName}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <ExerciseForm
              action={updateExerciseAction}
              exercise={editingExercise}
              onSubmit={() => setEditingExercise(null)}
              submitLabel={text.saveChanges}
              text={text}
              user={user}
            />
          </section>
        </div>
      ) : null}
    </AdminChrome>
  );
}

export function AdminSubmissionsPage({
  submissions,
  user,
}: AdminSubmissionsPageProps) {
  const { language } = useI18n();
  const text = copy[language];
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState("all");
  const [exercise, setExercise] = useState("all");
  const [organization, setOrganization] = useState("all");
  const [status, setStatus] = useState("all");
  const [testResult, setTestResult] = useState("all");
  const [groupBy, setGroupBy] = useState<"none" | "student" | "exercise">(
    "none",
  );
  const [previewSubmission, setPreviewSubmission] =
    useState<AdminSubmission | null>(null);
  const students = useMemo(
    () =>
      Array.from(
        new Map(
          submissions.map((submission) => [
            submission.studentUsername,
            {
              label: submission.studentName,
              value: submission.studentUsername,
            },
          ]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [submissions],
  );
  const exercises = useMemo(
    () =>
      Array.from(
        new Set(
          submissions.map(
            (submission) => submission.exerciseTitle ?? text.freeSubmission,
          ),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [submissions, text.freeSubmission],
  );
  const organizations = useMemo(
    () =>
      Array.from(
        new Map(
          submissions.map((submission) => [
            String(submission.organizationId ?? "unassigned"),
            submission.organizationName ?? "Unassigned",
          ]),
        ).entries(),
      ).sort(([, a], [, b]) => a.localeCompare(b)),
    [submissions],
  );
  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return submissions.filter((submission) => {
      const exerciseTitle = submission.exerciseTitle ?? text.freeSubmission;
      const matchesQuery =
        !normalizedQuery ||
        [
          submission.title,
          submission.studentName,
          submission.studentUsername,
          exerciseTitle,
          submission.organizationName ?? "",
        ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      const matchesStudent =
        student === "all" || submission.studentUsername === student;
      const matchesExercise = exercise === "all" || exerciseTitle === exercise;
      const matchesOrganization =
        organization === "all" ||
        String(submission.organizationId ?? "unassigned") === organization;
      const matchesStatus = status === "all" || submission.status === status;
      const matchesTest =
        testResult === "all" ||
        (testResult === "passed" && submission.testPassed === true) ||
        (testResult === "failed" && submission.testPassed === false) ||
        (testResult === "none" && submission.testPassed === null);

      return (
        matchesQuery &&
        matchesStudent &&
        matchesExercise &&
        matchesOrganization &&
        matchesStatus &&
        matchesTest
      );
    });
  }, [exercise, organization, query, status, student, submissions, testResult, text.freeSubmission]);
  const submissionGroups = useMemo(() => {
    if (groupBy === "none") {
      return [["", filteredSubmissions]] as const;
    }

    const groups = new Map<string, AdminSubmission[]>();

    for (const submission of filteredSubmissions) {
      const key =
        groupBy === "student"
          ? submission.studentName
          : (submission.exerciseTitle ?? text.freeSubmission);
      groups.set(key, [...(groups.get(key) ?? []), submission]);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredSubmissions, groupBy, text.freeSubmission]);
  const stats = {
    submitted: submissions.filter((item) => item.status === "submitted").length,
    needsWork: submissions.filter(
      (item) => item.status === "incomplete" || item.status === "rejected",
    ).length,
    approved: submissions.filter((item) => item.status === "approved").length,
  };

  return (
    <AdminChrome user={user}>
      <PageHeader
        count={submissions.length}
        help={text.submissionsHelp}
        title={text.submissions}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label={text.awaitingReview} value={stats.submitted} tone="neutral" />
        <MetricCard label={text.needsWork} value={stats.needsWork} tone="danger" />
        <MetricCard label={text.passed} value={stats.approved} tone="success" />
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.4fr)_repeat(5,minmax(130px,0.7fr))]">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.search}
            className={inputClassName}
          />
          <select value={student} onChange={(event) => setStudent(event.target.value)} className={inputClassName}>
            <option value="all">{text.allStudents}</option>
            {students.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
            className={inputClassName}
          >
            <option value="all">{text.allOrganizations}</option>
            {organizations.map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
          <select value={exercise} onChange={(event) => setExercise(event.target.value)} className={inputClassName}>
            <option value="all">{text.allExercises}</option>
            {exercises.map((option) => (
              <option value={option} key={option}>{option}</option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClassName}>
            <option value="all">{text.allStatuses}</option>
            <option value="submitted">submitted</option>
            <option value="approved">approved</option>
            <option value="incomplete">incomplete</option>
            <option value="rejected">rejected</option>
          </select>
          <select value={testResult} onChange={(event) => setTestResult(event.target.value)} className={inputClassName}>
            <option value="all">{text.allTestResults}</option>
            <option value="passed">{text.testPassedFilter}</option>
            <option value="failed">{text.testFailedFilter}</option>
            <option value="none">{text.noTestFilter}</option>
          </select>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500">
            {text.showing} <strong className="text-neutral-900">{filteredSubmissions.length}</strong> {text.of} {submissions.length}
          </p>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            {text.groupBy}
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)} className={`${inputClassName} py-1.5`}>
              <option value="none">{text.noGrouping}</option>
              <option value="student">{text.groupStudent}</option>
              <option value="exercise">{text.groupExercise}</option>
            </select>
          </label>
        </div>
      </section>

      {filteredSubmissions.length > 0 ? (
        <div className="grid gap-6">
          {submissionGroups.map(([groupName, groupSubmissions]) => (
            <section key={groupName || "all"}>
              {groupName ? (
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{groupName}</h2>
                  <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
                    {groupSubmissions.length}
                  </span>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {groupSubmissions.map((submission) => (
                  <SubmissionPreviewCard
                    key={submission.id}
                    onPreview={() => setPreviewSubmission(submission)}
                    submission={submission}
                    text={text}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState label={submissions.length > 0 ? text.noMatchingRows : text.noRows} />
      )}
      {previewSubmission?.diagramJson ? (
        <DiagramPreviewModal
          onClose={() => setPreviewSubmission(null)}
          submission={previewSubmission}
        />
      ) : null}
    </AdminChrome>
  );
}

type AdminCopy = (typeof copy)[keyof typeof copy];

function ExerciseForm({
  action,
  exercise,
  onSubmit,
  submitLabel,
  text,
  user,
}: {
  action: (formData: FormData) => void | Promise<void>;
  exercise?: AdminExercise;
  onSubmit?: () => void;
  submitLabel: string;
  text: AdminCopy;
  user: SessionUser;
}) {
  return (
    <form
      action={action}
      className="mt-4 grid gap-3"
      key={exercise ? (exercise.sourceId ?? exercise.id) : "new"}
      onSubmit={onSubmit}
    >
      {exercise?.id ? (
        <input name="exerciseId" type="hidden" value={exercise.id} />
      ) : null}
      {exercise?.sourceId ? (
        <input name="sourceId" type="hidden" value={exercise.sourceId} />
      ) : null}
      {exercise?.scope === "organization" ? (
        <>
          <input
            name="organizationId"
            type="hidden"
            value={exercise.organizationId ?? ""}
          />
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span className="font-semibold">{text.organization}:</span>{" "}
            {exercise.organizationName}
          </p>
        </>
      ) : user.role === "admin" ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
          <span className="font-semibold">{text.globalCatalog}.</span>{" "}
          {text.globalExerciseHelp}
        </p>
      ) : (
        <>
          <input
            name="organizationId"
            type="hidden"
            value={user.organizationId ?? ""}
          />
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span className="font-semibold">{text.organization}:</span>{" "}
            {user.organizationName ?? "—"}. {text.organizationExerciseHelp}
          </p>
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {text.exerciseTitle}
          <input
            name="title"
            defaultValue={exercise?.title}
            placeholder={text.exerciseTitle}
            className={inputClassName}
            required
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Difficulty
          <select
            name="difficulty"
            className={inputClassName}
            defaultValue={exercise?.difficulty ?? "facil"}
          >
            <option value="facil">facil</option>
            <option value="media">media</option>
            <option value="dificil">dificil</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {text.description}
        <textarea
          name="description"
          defaultValue={exercise?.description}
          placeholder={text.description}
          className={`${inputClassName} min-h-20 resize-y normal-case tracking-normal`}
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {text.objective}
        <textarea
          name="objective"
          defaultValue={exercise?.objective}
          placeholder={text.objective}
          className={`${inputClassName} min-h-20 resize-y normal-case tracking-normal`}
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        Starter code
        <textarea
          name="starterCode"
          defaultValue={exercise?.starterCode}
          placeholder={text.starterCode}
          className={`${inputClassName} min-h-28 resize-y font-mono text-xs normal-case tracking-normal`}
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {text.tests}
        <textarea
          name="testCases"
          defaultValue={exercise?.testCases}
          placeholder={text.testCases}
          className={`${inputClassName} min-h-28 resize-y font-mono text-xs normal-case tracking-normal`}
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {text.submissionDeadline}
        <input
          name="submissionDeadline"
          type="datetime-local"
          defaultValue={exercise?.submissionDeadline}
          className={`${inputClassName} normal-case tracking-normal`}
        />
        <span className="text-[11px] font-normal normal-case tracking-normal text-neutral-500">
          {text.submissionDeadlineHelp}
        </span>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {text.tags}
        <input
          name="tags"
          defaultValue={exercise?.tags}
          placeholder={text.tags}
          className={`${inputClassName} normal-case tracking-normal`}
        />
      </label>
      <button className={`${primaryButtonClassName} mt-1`}>{submitLabel}</button>
    </form>
  );
}

function ExerciseCard({
  exercise,
  onEdit,
  text,
}: {
  exercise: AdminExercise;
  onEdit?: () => void;
  text: AdminCopy;
}) {
  return (
    <article className="group flex min-h-64 flex-col rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:shadow-lg hover:shadow-emerald-950/5">
      <div className="flex items-start justify-between gap-3">
        <DifficultyBadge difficulty={exercise.difficulty} />
        <span className="text-xs font-medium text-neutral-400">
          {exercise.isBuiltIn ? "Built-in" : `#${exercise.id}`}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug text-neutral-950">
        {exercise.title}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-600">
        {exercise.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {exercise.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 4)
          .map((tag) => (
            <span key={tag} className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-neutral-600 ring-1 ring-neutral-200">
              {tag}
            </span>
          ))}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-neutral-200 pt-4 text-xs text-neutral-500">
        <span>{exercise.hasTests ? text.tests : text.noTests}</span>
        <span className="text-right">
          {exercise.submissionCount} {text.submissionsCount}
        </span>
        <span className="col-span-2 truncate">
          {text.createdBy}: {exercise.createdBy ?? "—"}
        </span>
        <span className="col-span-2 truncate font-medium text-emerald-800">
          {exercise.scope === "global"
            ? text.globalCatalog
            : `${text.organization}: ${exercise.organizationName ?? "—"}`}
        </span>
        <span className="col-span-2 truncate">
          {exercise.submissionDeadline
            ? `${text.submissionDeadline}: ${formatDeadline(exercise.submissionDeadline)}`
            : text.noDeadline}
        </span>
      </div>
      {exercise.canManage && onEdit ? (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onEdit} className={`${secondaryButtonClassName} flex-1`}>
            {text.edit}
          </button>
          <form
            action={deleteExerciseAction}
            onSubmit={(event) => {
              if (!window.confirm(text.deleteExerciseConfirm)) {
                event.preventDefault();
              }
            }}
          >
            {exercise.id ? (
              <input name="exerciseId" type="hidden" value={exercise.id} />
            ) : null}
            {exercise.sourceId ? (
              <input name="sourceId" type="hidden" value={exercise.sourceId} />
            ) : null}
            <button className={dangerButtonClassName}>{text.deleteExercise}</button>
          </form>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-center text-xs font-medium text-neutral-600">
          {text.globalCatalog}
        </p>
      )}
    </article>
  );
}

function SubmissionPreviewCard({
  onPreview,
  submission,
  text,
}: {
  onPreview: () => void;
  submission: AdminSubmission;
  text: AdminCopy;
}) {
  const failedCases =
    submission.testResult?.cases.filter((testCase) => !testCase.passed) ?? [];
  const nodeCount = submission.diagramJson?.main.nodes.length ?? 0;

  return (
    <article className="group rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-950/5">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-emerald-700">
              {submission.exerciseTitle ?? text.freeSubmission}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-neutral-500">
              {text.organization}: {submission.organizationName ?? "—"}
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold">{submission.title}</h3>
          </div>
          <StatusBadge status={submission.status} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-800">{submission.studentName}</p>
            <p className="truncate text-xs text-neutral-500">@{submission.studentUsername}</p>
          </div>
          <div className="shrink-0 text-right text-xs text-neutral-500">
            <p>{submission.submittedAt}</p>
            <p className="mt-0.5">{nodeCount} {text.blocks}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onPreview}
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-3 text-left text-emerald-950 outline-none transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          aria-label={`Open diagram preview for ${submission.title}`}
        >
          <span>
            <span className="block text-sm font-semibold">Open diagram preview</span>
            <span className="mt-0.5 block text-xs text-emerald-800/70">
              Original layout · {nodeCount} {text.blocks}
            </span>
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-lg text-white shadow-sm" aria-hidden="true">
            ↗
          </span>
        </button>
        <div className="mt-4 flex min-h-12 items-start justify-between gap-3 border-t border-neutral-100 pt-3">
          <div>
            <TestBadge
              failedLabel={text.testsFailed}
              noTestsLabel={text.noTests}
              passed={submission.testPassed}
              passedLabel={text.testsPassed}
            />
            {failedCases.length > 0 ? (
              <p className="mt-1.5 text-xs font-medium text-red-700">
                {failedCases.length} {text.failedCases}
              </p>
            ) : submission.feedback ? (
              <p className="mt-1.5 text-xs font-medium text-blue-700">
                {text.correctionsSaved}
              </p>
            ) : null}
          </div>
          <Link href={`/admin/submissions/${submission.id}`} className={primaryButtonClassName}>
            {text.review} →
          </Link>
        </div>
      </div>
    </article>
  );
}

function DiagramPreviewModal({
  onClose,
  submission,
}: {
  onClose: () => void;
  submission: AdminSubmission;
}) {
  const program = submission.diagramJson!;
  const [activeDiagramId, setActiveDiagramId] = useState("main");
  const activeFunction = program.functions.find(
    (flowFunction) => flowFunction.id === activeDiagramId,
  );
  const diagram = activeFunction ?? program.main;
  const availableFunctions = useMemo(
    () =>
      program.functions.map((flowFunction) => ({
        id: flowFunction.id,
        name: flowFunction.name,
        parameters: flowFunction.parameters,
        parameterDefinitions: flowFunction.parameterDefinitions,
      })),
    [program.functions],
  );
  const nodes = useMemo<FlowEditorNode[]>(
    () =>
      diagram.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          availableFunctions,
          onLabelChange: () => undefined,
          onConfigChange: () => undefined,
          onHandlePositionsChange: () => undefined,
        },
      })),
    [availableFunctions, diagram.nodes],
  );
  const edges = diagram.edges as FlowEditorEdge[];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-950/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagram-preview-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="flex h-[min(900px,94vh)] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl">
        <header className="flex flex-col gap-3 border-b border-neutral-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Diagram preview · {submission.studentName}
            </p>
            <h2 id="diagram-preview-title" className="mt-1 truncate text-xl font-semibold">
              {submission.title}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              Stored node positions and connections · Read only
            </p>
          </div>
          <div className="flex items-center gap-2">
            {program.functions.length > 0 ? (
              <select
                value={activeDiagramId}
                onChange={(event) => setActiveDiagramId(event.target.value)}
                className={inputClassName}
                aria-label="Select diagram"
              >
                <option value="main">Main diagram</option>
                {program.functions.map((flowFunction) => (
                  <option key={flowFunction.id} value={flowFunction.id}>
                    Function: {flowFunction.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className={iconButtonClassName}
              aria-label="Close diagram preview"
              title="Close preview"
            >
              ×
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 bg-neutral-100">
          <FlowNodeRenderProvider
            value={{
              availableFunctions,
              getExecution: () => undefined,
            }}
          >
            <ReactFlow<FlowEditorNode, FlowEditorEdge>
              key={activeDiagramId}
              nodes={nodes}
              edges={edges}
              nodeTypes={flowNodeComponents}
              edgeTypes={flowEdgeComponents}
              fitView
              fitViewOptions={{ padding: 0.2, minZoom: 0.2, maxZoom: 1.2 }}
              minZoom={0.1}
              maxZoom={2}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              zoomOnPinch
              zoomOnDoubleClick={false}
              className="flow-editor-canvas bg-neutral-100 [&_.react-flow__node]:pointer-events-none"
              attributionPosition="bottom-right"
            >
              <Background variant={BackgroundVariant.Lines} color="#d4d4d4" gap={24} />
              <Controls
                position="bottom-left"
                showInteractive={false}
                className="!rounded-lg !border !border-neutral-300 !bg-white !shadow-md [&_button]:!border-neutral-200"
              />
              <MiniMap<FlowEditorNode>
                position="bottom-right"
                nodeColor={(node) => getPreviewNodeColor(node.type)}
                pannable
                zoomable
                className="!rounded-lg !border !border-neutral-300 !bg-white !shadow-md"
              />
            </ReactFlow>
          </FlowNodeRenderProvider>
        </div>
      </section>
    </div>
  );
}

function getPreviewNodeColor(type: string) {
  if (type === "start" || type === "end") return "#bbf7d0";
  if (type === "decision") return "#fef08a";
  if (type === "input" || type === "output") return "#bfdbfe";
  if (type === "functionCall" || type === "return") return "#ddd6fe";
  return "#f5f5f5";
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const className =
    difficulty === "dificil"
      ? "bg-red-50 text-red-700 ring-red-200"
      : difficulty === "media"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>
      {difficulty}
    </span>
  );
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "danger" | "neutral" | "success";
  value: number;
}) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
      : tone === "danger"
        ? "border-red-200 bg-red-50/70 text-red-950"
        : "border-neutral-200 bg-white text-neutral-950";

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </article>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="col-span-full rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-12 text-center text-sm text-neutral-500">
      {label}
    </div>
  );
}

export function SubmissionReviewForm({
  feedback,
  status,
  submissionId,
}: {
  feedback: string | null;
  status: string;
  submissionId: number;
}) {
  return (
    <form
      action={updateSubmissionReviewAction}
      className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <input name="submissionId" type="hidden" value={submissionId} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Teacher review
        </p>
        <h2 className="mt-1 text-lg font-semibold">Corrections and feedback</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Explain the error, the expected approach, and what the student should change.
        </p>
      </div>
      <label className="text-sm font-semibold text-neutral-800">
        Review status
        <select
          name="status"
          className={`${inputClassName} mt-2 w-full`}
          defaultValue={status}
        >
          <option value="submitted">submitted</option>
          <option value="approved">approved</option>
          <option value="incomplete">incomplete</option>
          <option value="rejected">rejected</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-neutral-800">
        Corrections for the student
        <textarea
          name="feedback"
          className={`${inputClassName} mt-2 min-h-36 w-full resize-y`}
          defaultValue={feedback ?? ""}
          placeholder="Example: The loop stops one iteration early. Change the condition from i < n to i <= n and run the failed test again."
        />
      </label>
      <button className={primaryButtonClassName}>Save corrections</button>
    </form>
  );
}

export function TestResultPanel({
  result,
}: {
  result: import("@/lib/flow-test-runner").ExerciseTestRunResult | null;
}) {
  if (!result) {
    return (
      <section className={panelClassName}>
        <PanelTitle>Errors and automatic tests</PanelTitle>
        <p className="mt-3 text-sm text-neutral-600">
          This exercise has no automatic test result for this submission.
        </p>
      </section>
    );
  }

  return (
    <section className={panelClassName}>
      <PanelTitle>Errors and automatic tests</PanelTitle>
      <div className="mt-4 flex items-center justify-between rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-200">
        <p className="text-sm font-semibold text-neutral-800">
          {result.passedCount}/{result.total} passed
        </p>
        <span className={result.passed ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-red-700"}>
          {result.passed ? "All tests passed" : `${result.total - result.passedCount} need attention`}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {result.cases.map((testCase) => (
          <article
            key={testCase.name}
            className={testCase.passed ? "rounded-lg border border-emerald-200 bg-emerald-50/40 p-3" : "rounded-lg border border-red-200 bg-red-50/50 p-3"}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{testCase.name}</p>
              <span
                className={
                  testCase.passed
                    ? "rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                    : "rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800"
                }
              >
                {testCase.passed ? "passed" : "failed"}
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-600">
              Expected: {testCase.expectedOutputs.join(", ") || "-"}
            </p>
            <p className="text-xs text-neutral-600">
              Actual: {testCase.actualOutputs.join(", ") || "-"}
            </p>
            {!testCase.passed && testCase.message ? (
              <p className="mt-2 rounded-md bg-white/80 px-2.5 py-2 text-xs font-medium text-red-800 ring-1 ring-red-200">
                Error: {testCase.message}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminChrome({ children, user }: AdminChromeProps) {
  const { language, setLanguage } = useI18n();
  const text = copy[language];
  const nextLanguage = language === "es" ? "en" : "es";
  const pathname = usePathname();
  const navItems = [
    { href: "/admin/submissions", label: text.submissions, roles: ["teacher", "admin"] },
    { href: "/admin/users", label: text.users, roles: ["teacher", "admin"] },
    { href: "/admin/exercises", label: text.exercises, roles: ["teacher", "admin"] },
    { href: "/admin/organizations", label: text.organizations, roles: ["admin"] },
  ];

  return (
    <main className="min-h-screen bg-[#f5f6f4] text-neutral-950 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-emerald-950/30 bg-[#12372a] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 lg:block lg:px-5 lg:py-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-white p-1.5 shadow-lg shadow-black/10">
              <Image src={logoImage} alt="FlowCode" className="h-9 w-auto object-contain" priority />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">{text.eyebrow}</p>
              <h1 className="truncate text-lg font-semibold">FlowCode</h1>
            </div>
          </div>
          <button
            type="button"
            aria-label={text.languageToggle}
            title={text.languageToggle}
            onClick={() => setLanguage(nextLanguage)}
            className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white/10 lg:hidden"
          >
            {language.toUpperCase()}
          </button>
        </div>

        <div className="hidden px-4 pt-5 lg:block">
          <div className="rounded-xl border border-white/10 bg-white/8 p-3">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="mt-0.5 truncate text-xs text-emerald-100/70">@{user.username}</p>
            {user.organizationName ? (
              <p className="mt-1 truncate text-xs font-medium text-emerald-100">
                {user.organizationName}
              </p>
            ) : null}
            <span className="mt-3 inline-flex rounded-full bg-emerald-300/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-100 ring-1 ring-emerald-300/20">
              {user.role}
            </span>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-4 py-3 lg:grid lg:gap-1 lg:overflow-visible lg:px-4 lg:py-5">
          {navItems
            .filter((item) => item.roles.includes(user.role))
            .map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? "whitespace-nowrap rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-emerald-950 shadow-sm lg:w-full"
                      : "whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium text-emerald-50/75 transition hover:bg-white/10 hover:text-white lg:w-full"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
        </nav>

        <div className="flex gap-2 px-4 pb-4 lg:hidden">
          <Link href="/" className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-center text-xs font-semibold transition hover:bg-white/10">
            {text.openEditor}
          </Link>
          <form action={logoutAction} className="flex-1">
            <button className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-50">
              {text.signOut}
            </button>
          </form>
        </div>

        <div className="mt-auto hidden grid-cols-2 gap-2 border-t border-white/10 p-4 lg:grid">
          <button
            type="button"
            aria-label={text.languageToggle}
            title={text.languageToggle}
            onClick={() => setLanguage(nextLanguage)}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold transition hover:bg-white/10"
          >
            {language.toUpperCase()}
          </button>
          <Link href="/" className="rounded-lg border border-white/15 px-3 py-2 text-center text-xs font-semibold transition hover:bg-white/10">
            {text.openEditor}
          </Link>
          <form action={logoutAction} className="col-span-2">
            <button className="w-full rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-50">
              {text.signOut}
            </button>
          </form>
        </div>
      </aside>

      <section className="min-w-0">
        <header className="sticky top-0 z-20 hidden border-b border-neutral-200/80 bg-[#f5f6f4]/90 px-6 py-4 backdrop-blur lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{text.activeRole}: {user.role}</p>
            <h2 className="mt-0.5 text-lg font-semibold">{text.title}</h2>
          </div>
          <p className="text-sm text-neutral-500">
            {text.signedIn} {user.fullName}
            {user.organizationName ? ` · ${user.organizationName}` : ""}
          </p>
        </header>
        <div className="grid w-full gap-5 px-4 py-5 sm:px-5 lg:px-6 lg:py-6 2xl:px-8">{children}</div>
      </section>
    </main>
  );
}

function PageHeader({
  count,
  help,
  title,
}: {
  count: number;
  help: string;
  title: string;
}) {
  const { language } = useI18n();
  const text = copy[language];

  return (
    <section className="rounded-lg border border-neutral-300/80 bg-white p-4 shadow-md shadow-neutral-200/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-neutral-600">{help}</p>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-900">
          <span className="block text-xs font-semibold uppercase">
            {text.total}
          </span>
          <span className="text-2xl font-semibold">{count}</span>
        </div>
      </div>
    </section>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
      <h2 className="text-lg font-semibold">{children}</h2>
      <span
        className="h-2.5 w-2.5 rounded-full bg-emerald-500"
        aria-hidden="true"
      />
    </div>
  );
}

function CreationMessage({ state }: { state: UserCreationState }) {
  if (!state.message && !state.errors?.length) {
    return null;
  }

  const className =
    state.status === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : state.status === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-red-300 bg-red-50 text-red-900";

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${className}`}>
      {state.message ? <p>{state.message}</p> : null}
      {state.errors?.length ? (
        <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
          {state.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AdminTable({
  children,
  count,
  emptyLabel,
  head,
  title,
  toolbar,
}: {
  children: ReactNode;
  count?: number;
  emptyLabel: string;
  head?: ReactNode;
  title: string;
  toolbar?: ReactNode;
}) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-neutral-300/80 bg-white shadow-md shadow-neutral-200/70">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50/80 px-4 py-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs font-semibold text-neutral-600">
          {count ?? (hasRows && Array.isArray(children) ? children.length : 0)}
        </span>
      </div>
      {toolbar ? <div className="border-b border-neutral-200 p-3">{toolbar}</div> : null}
      <div className="max-h-[calc(100vh-18rem)] overflow-auto">
        <table className="w-full min-w-[1320px] table-fixed text-left text-sm">
          {head ? <thead className="sticky top-0 z-10">{head}</thead> : null}
          <tbody>
            {hasRows ? (
              children
            ) : (
              <tr>
                <td className="px-3 py-4 text-neutral-500">{emptyLabel}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function groupTypeLabel(
  type: AdminUserGroup["type"],
  labels: {
    administrators: string;
    course: string;
    custom: string;
    organizationGroup: string;
  },
) {
  if (type === "administrators") {
    return labels.administrators;
  }

  if (type === "course") {
    return labels.course;
  }

  if (type === "organization") {
    return labels.organizationGroup;
  }

  return labels.custom;
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
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
}

function TestBadge({
  failedLabel,
  noTestsLabel,
  passed,
  passedLabel,
}: {
  failedLabel: string;
  noTestsLabel: string;
  passed: boolean | null;
  passedLabel: string;
}) {
  const label =
    passed === null ? noTestsLabel : passed ? passedLabel : failedLabel;
  const className =
    passed === null
      ? "border-neutral-300 bg-neutral-50 text-neutral-600"
      : passed
        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
        : "border-red-300 bg-red-50 text-red-800";

  return (
    <span className={`mt-1 inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function formatDeadline(value: string) {
  return value.replace("T", " ");
}

const inputClassName =
  "rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm outline-none transition hover:border-neutral-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/20";

const primaryButtonClassName =
  "rounded-md border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:border-neutral-800 hover:bg-neutral-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0";

const secondaryButtonClassName =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 shadow-sm transition-all hover:-translate-y-px hover:border-neutral-500 hover:bg-neutral-50 hover:text-neutral-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:translate-y-0";

const panelClassName =
  "rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow-md sm:p-5";

const tableRowClassName =
  "border-t border-neutral-200 transition hover:bg-emerald-50/40";

const tableCellClassName = "break-words px-3 py-2 align-top";

const dangerButtonClassName =
  "rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2";

const iconButtonClassName =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-xl leading-none text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600";
