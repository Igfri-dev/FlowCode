"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow } from "@xyflow/react";
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
import { AppHeader } from "@/components/ui/AppHeader";
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
import { AdminIcon } from "./AdminIcon";

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
    title: "Administración de FlowCode",
    signedIn: "Sesión iniciada como",
    openEditor: "Creador de diagramas",
    signOut: "Cerrar sesión",
    createUser: "Crear usuario",
    createOrganization: "Crear organización",
    organizationName: "Nombre de la organización",
    organization: "Organización",
    organizations: "Organizaciones",
    organizationsHelp:
      "Crea espacios independientes para profesores, alumnos, ejercicios y entregas.",
    assignOrganization: "Asignar",
    selectOrganization: "Selecciona una organización",
    teachers: "Profesores",
    students: "Alumnos",
    adminGlobalAccess: "Los administradores tienen acceso global.",
    fullName: "Nombre completo",
    username: "Usuario",
    password: "Contraseña",
    email: "Correo electrónico",
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
    bulkUsersHelp: "Columnas: nombre, usuario, contraseña, correo, tipo_de_usuario y organizacion.",
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
      "¿Eliminar este ejercicio? Las entregas existentes se conservarán como entregas libres.",
    exerciseTitle: "Título",
    description: "Descripción",
    objective: "Objetivo",
    starterCode:
      "JavaScript inicial opcional. Se guardará, pero no se mostrará como solución en el importador.",
    testCases: 'Tests en JSON. Ejemplo: [{"name":"caso 1","inputs":[5],"expectedOutputs":["10"]}]',
    submissionDeadline: "Fecha límite de entrega",
    submissionDeadlineHelp:
      "Opcional. Después de esta fecha los alumnos no pueden entregar ni editar.",
    noDeadline: "Sin fecha límite",
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
    submissionsHelp: "Revisa diagramas enviados y ejecútalos para evaluarlos.",
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
    needsWork: "Necesitan corrección",
    passed: "Aprobadas",
    submissionsCount: "entregas",
    edit: "Editar",
    createdBy: "Creado por",
    noMatchingRows: "No hay resultados para estos filtros.",
    correctionsSaved: "Correcciones guardadas",
    noRows: "Sin registros todavía.",
    freeSubmission: "Entrega libre",
    review: "Revisar",
    tests: "Tests",
    testsPassed: "Tests aprobados",
    testsFailed: "Tests fallidos",
    noTests: "Sin tests",
    languageToggle: "Cambiar idioma",
    activeRole: "Rol activo",
    total: "Total",
    close: "Cerrar",
    preview: "Vista previa del diagrama",
    originalLayout: "Distribución original",
    previewHelp: "Posiciones y conexiones guardadas · Solo lectura",
    selectDiagram: "Seleccionar diagrama",
    mainDiagram: "Diagrama principal",
    function: "Función",
    difficulty: "Dificultad",
    starterCodeLabel: "Código inicial",
  },
  en: {
    eyebrow: "Panel",
    title: "FlowCode administration",
    signedIn: "Signed in as",
    openEditor: "Diagram creator",
    signOut: "Sign out",
    createUser: "Create user",
    createOrganization: "Create organization",
    organizationName: "Organization name",
    organization: "Organization",
    organizations: "Organizations",
    organizationsHelp: "Create isolated spaces for teachers, students, exercises, and submissions.",
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
    testCases: 'JSON tests. Example: [{"name":"case 1","inputs":[5],"expectedOutputs":["10"]}]',
    submissionDeadline: "Submission deadline",
    submissionDeadlineHelp: "Optional. After this time, students cannot submit or edit their work.",
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
    close: "Close",
    preview: "Diagram preview",
    originalLayout: "Original layout",
    previewHelp: "Stored node positions and connections · Read only",
    selectDiagram: "Select diagram",
    mainDiagram: "Main diagram",
    function: "Function",
    difficulty: "Difficulty",
    starterCodeLabel: "Starter code",
  },
} as const;

export function AdminUsersPage({ groups, organizations, user, users }: AdminUsersPageProps) {
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
          close: "Cerrar",
          course: "Curso",
          createGroup: "Crear grupo",
          custom: "Personalizado",
          deactivate: "Desactivar",
          delete: "Eliminar",
          deleteGroup: "Eliminar grupo",
          deleteGroupAndUsers: "Eliminar grupo y usuarios",
          deleteGroupConfirm: "¿Eliminar solo este grupo? Las cuentas de usuario se conservarán.",
          deleteGroupUsersConfirm:
            "¿Eliminar este grupo Y todas sus cuentas de usuario? También se borrarán sus sesiones, proyectos y entregas. Esta acción no se puede deshacer.",
          deleteSelectedConfirm:
            "¿Eliminar definitivamente las cuentas seleccionadas? También se borrarán sus sesiones, proyectos y entregas.",
          deleteUserConfirm: "¿Eliminar definitivamente esta cuenta y todos sus datos asociados?",
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
          close: "Close",
          course: "Course",
          createGroup: "Create group",
          custom: "Custom",
          deactivate: "Deactivate",
          delete: "Delete",
          deleteGroup: "Delete group",
          deleteGroupAndUsers: "Delete group and users",
          deleteGroupConfirm: "Delete only this group? User accounts will be preserved.",
          deleteGroupUsersConfirm:
            "Delete this group AND all its user accounts? Their sessions, projects, and submissions will also be deleted. This cannot be undone.",
          deleteSelectedConfirm:
            "Permanently delete the selected accounts? Their sessions, projects, and submissions will also be deleted.",
          deleteUserConfirm: "Permanently delete this account and all associated data?",
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
  const createUserLabel =
    user.role === "teacher"
      ? language === "es"
        ? "Crear alumno"
        : "Create student"
      : text.createUser;
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [managementState, managementAction, managementPending] = useActionState(
    manageSelectedUsersAction,
    {} as UserManagementState,
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
      const matchesGroup = selectedGroup === null || selectedGroup.memberIds.includes(item.id);

      return matchesQuery && matchesRole && matchesGroup;
    });
  }, [groupFilter, groups, normalizedQuery, roleFilter, users]);
  const selectableVisibleIds = filteredUsers
    .filter((item) => item.id !== user.id)
    .map((item) => item.id);
  const allVisibleSelected =
    selectableVisibleIds.length > 0 && selectableVisibleIds.every((id) => selectedIds.includes(id));
  const activeSelectedIds = selectedIds.filter((id) =>
    users.some((item) => item.id === id && item.id !== user.id),
  );
  const selectedUserIds = activeSelectedIds.join(",");
  function toggleUser(userId: number) {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
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
      <PageHeader
        count={users.length}
        help={text.usersHelp}
        title={text.users}
        actions={
          <>
            <button
              className={secondaryButtonClassName}
              onClick={() => setIsCreateGroupOpen(true)}
              type="button"
            >
              <AdminIcon name="users" />
              {ui.createGroup}
            </button>
            <button
              className={secondaryButtonClassName}
              onClick={() => setIsBulkUploadOpen(true)}
              type="button"
            >
              <AdminIcon name="upload" />
              {text.bulkUsers}
            </button>
            <button
              className={primaryButtonClassName}
              onClick={() => setIsCreateUserOpen(true)}
              type="button"
            >
              <AdminIcon name="plus" />
              {createUserLabel}
            </button>
          </>
        }
      />
      <section className={panelClassName}>
        <div className="w-full">
          <PanelTitle>{ui.groups}</PanelTitle>
          <p className="mt-2 text-sm leading-6 text-slate-600">{ui.groupsHelp}</p>
        </div>
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-3">
          {groups.map((group) => (
            <article
              key={group.id}
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-950">{group.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {groupTypeLabel(group.type, ui)} · {group.organizationName ?? ui.global}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
                  {group.memberCount} {ui.members}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={`${secondaryButtonClassName} px-2.5 py-1.5 text-xs`}
                  type="button"
                  onClick={() => {
                    setSelectedIds(group.memberIds.filter((memberId) => memberId !== user.id));
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
                  <button className={`${dangerButtonClassName} px-2.5 py-1.5 text-xs`}>
                    {ui.deleteGroupAndUsers}
                  </button>
                </form>
              </div>
            </article>
          ))}
          {groups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
              {text.noRows}
            </p>
          ) : null}
        </div>
      </section>

      <AdminTable
        count={filteredUsers.length}
        emptyLabel={text.noMatchingRows}
        title={text.users}
        head={
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
                aria-label={ui.filterUsers}
                className={inputClassName}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={ui.filterUsers}
                type="search"
                value={searchQuery}
              />
              <select
                aria-label={ui.allRoles}
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
                aria-label={ui.allGroups}
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
            {activeSelectedIds.length > 0 ? (
              <form
                action={managementAction}
                className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3"
                onSubmit={(event) => {
                  const submitter = (event.nativeEvent as SubmitEvent)
                    .submitter as HTMLButtonElement | null;

                  if (submitter?.value === "delete" && !window.confirm(ui.deleteSelectedConfirm)) {
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
                  <select
                    aria-label={ui.group}
                    className={`${inputClassName} w-auto max-w-full py-1.5 text-xs`}
                    name="groupId"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {ui.group}
                    </option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className={`${secondaryButtonClassName} px-2.5 py-1.5 text-xs`}
                    disabled={
                      managementPending || activeSelectedIds.length === 0 || groups.length === 0
                    }
                    name="operation"
                    value="addToGroup"
                  >
                    {ui.addToGroup}
                  </button>
                  <button
                    className={`${secondaryButtonClassName} px-2.5 py-1.5 text-xs`}
                    disabled={
                      managementPending || activeSelectedIds.length === 0 || groups.length === 0
                    }
                    name="operation"
                    value="removeFromGroup"
                  >
                    {ui.removeFromGroup}
                  </button>
                  {user.role === "admin" ? (
                    <>
                      <select
                        aria-label={text.organization}
                        className={`${inputClassName} w-auto max-w-full py-1.5 text-xs`}
                        name="organizationId"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          {text.selectOrganization}
                        </option>
                        {organizations
                          .filter((organization) => organization.isActive)
                          .map((organization) => (
                            <option key={organization.id} value={organization.id}>
                              {organization.name}
                            </option>
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
            ) : (
              <p className="flex items-center gap-2 text-xs leading-5 text-slate-500">
                <AdminIcon name="users" />
                {language === "es"
                  ? "Selecciona usuarios de la tabla para administrar sus cuentas y grupos."
                  : "Select users in the table to manage their accounts and groups."}
              </p>
            )}
          </div>
        }
      >
        {filteredUsers.map((item) => {
          const itemGroups = groups.filter((group) => group.memberIds.includes(item.id));
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
                <p className="font-semibold text-slate-900">{item.fullName}</p>
                <p className="mt-0.5 text-xs text-slate-500">@{item.username}</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                >
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
                  <button className={`${secondaryButtonClassName} px-2.5 py-1.5 text-xs`}>
                    Guardar
                  </button>
                </form>
              </td>
              <td className={tableCellClassName}>
                <span className="workspace-pill bg-slate-100 text-slate-600">{item.role}</span>
              </td>
              <td className={tableCellClassName}>
                {user.role === "admin" && (item.role === "student" || item.role === "teacher") ? (
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
                    <button className={`${secondaryButtonClassName} px-2.5 py-1.5 text-xs`}>
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
                    <span
                      key={group.id}
                      className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800"
                    >
                      {group.name}
                    </span>
                  ))}
                  {itemGroups.length === 0 ? (
                    <span className="text-xs text-slate-400">—</span>
                  ) : null}
                </div>
              </td>
              <td className={tableCellClassName}>
                {isCurrentUser ? (
                  <span className="text-xs text-slate-400">{text.signedIn}</span>
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
      {isBulkUploadOpen ? (
        <BulkUsersModal onClose={() => setIsBulkUploadOpen(false)} user={user} />
      ) : null}
      {isCreateGroupOpen ? (
        <CreateGroupModal
          labels={ui}
          onClose={() => setIsCreateGroupOpen(false)}
          organizations={organizations}
          user={user}
        />
      ) : null}
      {isCreateUserOpen ? (
        <CreateUserModal
          label={createUserLabel}
          onClose={() => setIsCreateUserOpen(false)}
          organizations={organizations}
          user={user}
        />
      ) : null}
    </AdminChrome>
  );
}

function AdminFormModal({
  children,
  closeLabel,
  description,
  extraWide = false,
  onClose,
  title,
  wide = false,
}: {
  children: ReactNode;
  closeLabel: string;
  description: string;
  extraWide?: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
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
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-labelledby="admin-form-modal-title"
        aria-modal="true"
        className={`my-auto w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/20 sm:p-6 ${
          extraWide ? "max-w-3xl" : wide ? "max-w-2xl" : "max-w-lg"
        }`}
        role="dialog"
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="workspace-eyebrow text-emerald-700">FlowCode</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950" id="admin-form-modal-title">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <button
            aria-label={closeLabel}
            className={iconButtonClassName}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function BulkUsersModal({ onClose, user }: { onClose: () => void; user: SessionUser }) {
  const { language } = useI18n();
  const text = copy[language];
  const closeLabel = language === "es" ? "Cerrar" : "Close";
  const processingLabel = language === "es" ? "Procesando..." : "Processing...";
  const [state, action, pending] = useActionState(bulkCreateUsersAction, {} as UserCreationState);
  const csvTemplate = encodeURIComponent(
    "nombre,usuario,contraseña,correo,tipo_de_usuario,organizacion\nAna Pérez,ana.perez,,ana@example.com,student,Mi organización\n",
  );

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [onClose, state]);

  return (
    <AdminFormModal
      closeLabel={closeLabel}
      description={text.bulkUsersHelp}
      onClose={onClose}
      title={text.bulkUsers}
    >
      <form action={action} className="grid gap-3">
        <label className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50/40">
          {text.selectCsv}
          <input
            accept=".csv,text/csv"
            autoFocus
            className="mt-3 block w-full text-xs font-normal file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:font-semibold file:text-white"
            name="csvFile"
            required
            type="file"
          />
        </label>
        <a
          className={`${secondaryButtonClassName} text-center`}
          download="plantilla-usuarios-flowcode.csv"
          href={`data:text/csv;charset=utf-8,${csvTemplate}`}
        >
          {text.downloadTemplate}
        </a>
        <CreationMessage state={state} />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button className={secondaryButtonClassName} onClick={onClose} type="button">
            {closeLabel}
          </button>
          <button className={primaryButtonClassName} disabled={pending}>
            {pending ? processingLabel : text.uploadCsv}
          </button>
        </div>
      </form>
      {user.role === "admin" ? (
        <form action={retryPendingEmailsAction} className="mt-4 border-t border-slate-200 pt-4">
          <button className={`${secondaryButtonClassName} w-full`}>{text.retryEmails}</button>
        </form>
      ) : null}
    </AdminFormModal>
  );
}

type CreateGroupModalLabels = {
  administrators: string;
  close: string;
  course: string;
  createGroup: string;
  custom: string;
  global: string;
  groupName: string;
  organizationGroup: string;
};

function CreateGroupModal({
  labels,
  onClose,
  organizations,
  user,
}: {
  labels: CreateGroupModalLabels;
  onClose: () => void;
  organizations: AdminOrganization[];
  user: SessionUser;
}) {
  const { language } = useI18n();
  const text = copy[language];
  const [newGroupType, setNewGroupType] = useState("course");
  const [state, action, pending] = useActionState(createUserGroupAction, {} as UserManagementState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [onClose, state]);

  return (
    <AdminFormModal
      closeLabel={labels.close}
      description={
        language === "es"
          ? "Define el nombre, tipo y alcance del nuevo grupo."
          : "Define the name, type, and scope of the new group."
      }
      onClose={onClose}
      title={labels.createGroup}
    >
      <form action={action} className="grid gap-3">
        <input
          autoFocus
          className={inputClassName}
          name="name"
          placeholder={labels.groupName}
          required
        />
        <select
          className={inputClassName}
          name="type"
          value={newGroupType}
          onChange={(event) => setNewGroupType(event.target.value)}
        >
          <option value="course">{labels.course}</option>
          <option value="custom">{labels.custom}</option>
          {user.role === "admin" ? (
            <>
              <option value="organization">{labels.organizationGroup}</option>
              <option value="administrators">{labels.administrators}</option>
            </>
          ) : null}
        </select>
        {user.role === "admin" && newGroupType !== "administrators" ? (
          <select className={inputClassName} name="organizationId" defaultValue="">
            <option value="">
              {newGroupType === "custom" ? labels.global : text.selectOrganization}
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
        <CreationMessage state={state} />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button className={secondaryButtonClassName} onClick={onClose} type="button">
            {labels.close}
          </button>
          <button className={primaryButtonClassName} disabled={pending}>
            {pending ? "…" : labels.createGroup}
          </button>
        </div>
      </form>
    </AdminFormModal>
  );
}

function CreateUserModal({
  label,
  onClose,
  organizations,
  user,
}: {
  label: string;
  onClose: () => void;
  organizations: AdminOrganization[];
  user: SessionUser;
}) {
  const { language } = useI18n();
  const text = copy[language];
  const closeLabel = language === "es" ? "Cerrar" : "Close";
  const [newUserRole, setNewUserRole] = useState("student");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [state, action, pending] = useActionState(createUserAction, {} as UserCreationState);
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

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [onClose, state]);

  return (
    <AdminFormModal
      closeLabel={closeLabel}
      description={
        user.role === "teacher"
          ? language === "es"
            ? "Completa los datos de la nueva cuenta de alumno."
            : "Complete the new student account details."
          : language === "es"
            ? "Completa los datos y define el rol de la nueva cuenta."
            : "Complete the details and select the role for the new account."
      }
      onClose={onClose}
      title={label}
      wide
    >
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input
          autoFocus
          name="fullName"
          placeholder={text.fullName}
          className={`${inputClassName} sm:col-span-2`}
          required
        />
        <div className="grid gap-1">
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
              usernameCheck.availability?.available ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {usernameCheck.pending ? text.usernameChecking : usernameCheck.availability?.message}
          </p>
        </div>
        <div className="grid gap-1">
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
              emailCheck.availability?.available ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {emailCheck.pending ? text.emailChecking : emailCheck.availability?.message}
          </p>
        </div>
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
          onChange={(event) => setNewPasswordConfirmation(event.target.value)}
        />
        <p className="text-xs leading-5 text-slate-600 sm:col-span-2">{text.passwordHelp}</p>
        {newPassword || newPasswordConfirmation ? (
          <p
            aria-live="polite"
            className={`text-xs sm:col-span-2 ${
              passwordMismatch ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {passwordMismatch ? text.passwordMismatch : text.passwordMatch}
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
              <select name="organizationId" className={inputClassName} defaultValue="" required>
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
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {text.adminGlobalAccess}
              </p>
            )}
          </>
        ) : (
          <>
            <input name="role" type="hidden" value="student" />
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 sm:col-span-2">
              {text.organization}: {user.organizationName ?? "—"}
            </p>
            {(organizations.find((organization) => organization.id === user.organizationId)
              ?.studentCount ?? 0) >= 60 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950 sm:col-span-2">
                La organización alcanzó 60 alumnos. Contacta a contacto@igfri.dev para ampliar el
                cupo.
              </p>
            ) : null}
          </>
        )}
        <div className="sm:col-span-2">
          <CreationMessage state={state} />
        </div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
          <button className={secondaryButtonClassName} onClick={onClose} type="button">
            {closeLabel}
          </button>
          <button
            className={primaryButtonClassName}
            disabled={
              pending ||
              usernameCheck.pending ||
              emailCheck.pending ||
              Boolean(normalizedNewUsername && !usernameCheck.availability?.available) ||
              Boolean(normalizedNewEmail && !emailCheck.availability?.available) ||
              passwordMismatch
            }
          >
            {pending ? "Creando..." : label}
          </button>
        </div>
      </form>
    </AdminFormModal>
  );
}

export function AdminOrganizationsPage({ organizations, user }: AdminOrganizationsPageProps) {
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
        <section className={`${panelClassName} xl:sticky xl:top-[160px]`}>
          <PanelTitle>{text.createOrganization}</PanelTitle>
          <form action={createOrganizationAction} className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
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
                className="workspace-panel min-w-0 p-5 transition-colors hover:border-slate-300"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
                  <AdminIcon name="organizations" className="h-5 w-5" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="workspace-eyebrow text-emerald-700">#{organization.id}</p>
                    <h2 className="mt-1 break-words text-lg font-semibold">{organization.name}</h2>
                    <p className="mt-0.5 break-all text-xs text-slate-500">{organization.slug}</p>
                  </div>
                  <span
                    className={`workspace-pill shrink-0 ${organization.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {organization.isActive
                      ? language === "es"
                        ? "Activa"
                        : "Active"
                      : language === "es"
                        ? "Inactiva"
                        : "Inactive"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <OrganizationMetric label={text.teachers} value={organization.teacherCount} />
                  <OrganizationMetric
                    label={text.students}
                    value={`${organization.studentCount}/60`}
                  />
                  <OrganizationMetric label={text.exercises} value={organization.exerciseCount} />
                  <OrganizationMetric
                    label={text.submissions}
                    value={organization.submissionCount}
                  />
                </div>
                {organization.studentCount >= 60 ? (
                  <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                    {language === "es"
                      ? "Cupo completo. Para ampliarlo, contacta a contacto@igfri.dev."
                      : "Full capacity. To increase it, contact contacto@igfri.dev."}
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="block text-lg font-semibold tabular-nums text-slate-900">{value}</span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}

export function AdminExercisesPage({ exercises, user }: AdminExercisesPageProps) {
  const { language } = useI18n();
  const text = copy[language];
  const [query, setQuery] = useState("");
  const [isCreateExerciseOpen, setIsCreateExerciseOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<AdminExercise | null>(null);
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
        actions={
          <button
            className={primaryButtonClassName}
            onClick={() => setIsCreateExerciseOpen(true)}
            type="button"
          >
            <AdminIcon name="plus" />
            {text.createExercise}
          </button>
        }
      />

      <section className="workspace-panel min-w-0 overflow-hidden p-0">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                {language === "es" ? "Catálogo de ejercicios" : "Exercise catalog"}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {text.showing} {filteredExercises.length} {text.of} {exercises.length}
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <AdminIcon
                name="search"
                className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
              />
              <input
                aria-label={text.searchExercises}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.searchExercises}
                className={`${inputClassName} pl-9`}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {filteredExercises.length > 0 ? (
            filteredExercises.map((exercise) => (
              <ExerciseCard
                exercise={exercise}
                key={`${exercise.organizationId}:${exercise.sourceId ?? exercise.id}`}
                onEdit={exercise.canManage ? () => setEditingExercise(exercise) : undefined}
                text={text}
              />
            ))
          ) : (
            <EmptyState label={exercises.length > 0 ? text.noMatchingRows : text.noRows} />
          )}
        </div>
      </section>

      {isCreateExerciseOpen ? (
        <AdminFormModal
          closeLabel={language === "es" ? "Cerrar" : "Close"}
          description={
            language === "es"
              ? "Completa el enunciado, configuración y pruebas del nuevo ejercicio."
              : "Complete the prompt, configuration, and tests for the new exercise."
          }
          extraWide
          onClose={() => setIsCreateExerciseOpen(false)}
          title={text.newExercise}
        >
          <ExerciseForm
            action={createExerciseAction}
            onSubmit={() => setIsCreateExerciseOpen(false)}
            submitLabel={text.createExercise}
            text={text}
            user={user}
          />
        </AdminFormModal>
      ) : null}

      {editingExercise ? (
        <AdminFormModal
          closeLabel={text.close}
          description={editingExercise.title}
          extraWide
          onClose={() => setEditingExercise(null)}
          title={text.editExercise}
        >
          <ExerciseForm
            action={updateExerciseAction}
            exercise={editingExercise}
            onSubmit={() => setEditingExercise(null)}
            submitLabel={text.saveChanges}
            text={text}
            user={user}
          />
        </AdminFormModal>
      ) : null}
    </AdminChrome>
  );
}

export function AdminSubmissionsPage({ submissions, user }: AdminSubmissionsPageProps) {
  const { language } = useI18n();
  const text = copy[language];
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState("all");
  const [exercise, setExercise] = useState("all");
  const [organization, setOrganization] = useState("all");
  const [status, setStatus] = useState("all");
  const [testResult, setTestResult] = useState("all");
  const [groupBy, setGroupBy] = useState<"none" | "student" | "exercise">("none");
  const [previewSubmission, setPreviewSubmission] = useState<AdminSubmission | null>(null);
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
        new Set(submissions.map((submission) => submission.exerciseTitle ?? text.freeSubmission)),
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
      const matchesStudent = student === "all" || submission.studentUsername === student;
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
  }, [
    exercise,
    organization,
    query,
    status,
    student,
    submissions,
    testResult,
    text.freeSubmission,
  ]);
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
      <PageHeader count={submissions.length} help={text.submissionsHelp} title={text.submissions} />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label={text.awaitingReview} value={stats.submitted} tone="neutral" />
        <MetricCard label={text.needsWork} value={stats.needsWork} tone="danger" />
        <MetricCard label={text.passed} value={stats.approved} tone="success" />
      </div>

      <section
        aria-label={language === "es" ? "Filtros de entregas" : "Submission filters"}
        className="workspace-panel p-4 sm:p-5"
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <AdminIcon name="search" />
          {language === "es" ? "Buscar y filtrar" : "Search and filter"}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(240px,1.6fr)_repeat(5,minmax(0,1fr))]">
          <input
            aria-label={text.search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.search}
            className={inputClassName}
          />
          <select
            aria-label={text.allStudents}
            value={student}
            onChange={(event) => setStudent(event.target.value)}
            className={inputClassName}
          >
            <option value="all">{text.allStudents}</option>
            {students.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label={text.allOrganizations}
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
            className={inputClassName}
          >
            <option value="all">{text.allOrganizations}</option>
            {organizations.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label={text.allExercises}
            value={exercise}
            onChange={(event) => setExercise(event.target.value)}
            className={inputClassName}
          >
            <option value="all">{text.allExercises}</option>
            {exercises.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            aria-label={text.allStatuses}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClassName}
          >
            <option value="all">{text.allStatuses}</option>
            {Object.entries(statusLabels[language]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label={text.allTestResults}
            value={testResult}
            onChange={(event) => setTestResult(event.target.value)}
            className={inputClassName}
          >
            <option value="all">{text.allTestResults}</option>
            <option value="passed">{text.testPassedFilter}</option>
            <option value="failed">{text.testFailedFilter}</option>
            <option value="none">{text.noTestFilter}</option>
          </select>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {text.showing} <strong className="text-slate-900">{filteredSubmissions.length}</strong>{" "}
            {text.of} {submissions.length}
          </p>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            {text.groupBy}
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as typeof groupBy)}
              className={`${inputClassName} w-auto py-1.5`}
            >
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
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {groupSubmissions.length}
                  </span>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
      {exercise?.id ? <input name="exerciseId" type="hidden" value={exercise.id} /> : null}
      {exercise?.sourceId ? (
        <input name="sourceId" type="hidden" value={exercise.sourceId} />
      ) : null}
      {exercise?.scope === "organization" ? (
        <>
          <input name="organizationId" type="hidden" value={exercise.organizationId ?? ""} />
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span className="font-semibold">{text.organization}:</span> {exercise.organizationName}
          </p>
        </>
      ) : user.role === "admin" ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
          <span className="font-semibold">{text.globalCatalog}.</span> {text.globalExerciseHelp}
        </p>
      ) : (
        <>
          <input name="organizationId" type="hidden" value={user.organizationId ?? ""} />
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span className="font-semibold">{text.organization}:</span>{" "}
            {user.organizationName ?? "—"}. {text.organizationExerciseHelp}
          </p>
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
          {text.exerciseTitle}
          <input
            name="title"
            defaultValue={exercise?.title}
            placeholder={text.exerciseTitle}
            className={inputClassName}
            required
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
          {text.difficulty}
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
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
        {text.description}
        <textarea
          name="description"
          defaultValue={exercise?.description}
          placeholder={text.description}
          className={`${inputClassName} min-h-20 resize-y normal-case tracking-normal`}
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
        {text.objective}
        <textarea
          name="objective"
          defaultValue={exercise?.objective}
          placeholder={text.objective}
          className={`${inputClassName} min-h-20 resize-y normal-case tracking-normal`}
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
        {text.starterCodeLabel}
        <textarea
          name="starterCode"
          defaultValue={exercise?.starterCode}
          placeholder={text.starterCode}
          className={`${inputClassName} min-h-28 resize-y font-mono text-xs normal-case tracking-normal`}
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
        {text.tests}
        <textarea
          name="testCases"
          defaultValue={exercise?.testCases}
          placeholder={text.testCases}
          className={`${inputClassName} min-h-28 resize-y font-mono text-xs normal-case tracking-normal`}
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
        {text.submissionDeadline}
        <input
          name="submissionDeadline"
          type="datetime-local"
          defaultValue={exercise?.submissionDeadline}
          className={`${inputClassName} normal-case tracking-normal`}
        />
        <span className="text-[11px] font-normal normal-case tracking-normal text-slate-500">
          {text.submissionDeadlineHelp}
        </span>
      </label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
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
    <article className="group flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-emerald-300">
      <div className="flex items-start justify-between gap-3">
        <DifficultyBadge difficulty={exercise.difficulty} />
        <span className="text-xs font-medium text-slate-400">
          {exercise.isBuiltIn ? "Built-in" : `#${exercise.id}`}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug text-slate-950">{exercise.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
        {exercise.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {exercise.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 4)
          .map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200"
            >
              {tag}
            </span>
          ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
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
            {exercise.id ? <input name="exerciseId" type="hidden" value={exercise.id} /> : null}
            {exercise.sourceId ? (
              <input name="sourceId" type="hidden" value={exercise.sourceId} />
            ) : null}
            <button className={dangerButtonClassName}>{text.deleteExercise}</button>
          </form>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-600">
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
  const failedCases = submission.testResult?.cases.filter((testCase) => !testCase.passed) ?? [];
  const nodeCount = submission.diagramJson?.main.nodes.length ?? 0;

  return (
    <article className="workspace-panel group min-w-0 p-0 transition-colors hover:border-emerald-300">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate workspace-eyebrow text-emerald-700">
              {submission.exerciseTitle ?? text.freeSubmission}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
              {text.organization}: {submission.organizationName ?? "—"}
            </p>
          </div>
          <StatusBadge status={submission.status} />
        </div>
        <h3 className="mt-2 break-words text-lg font-semibold leading-snug">{submission.title}</h3>
        <div className="mt-3 flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{submission.studentName}</p>
            <p className="truncate text-xs text-slate-500">@{submission.studentUsername}</p>
          </div>
          <div className="shrink-0 text-right text-xs text-slate-500">
            <p>{submission.submittedAt}</p>
            <p className="mt-0.5">
              {nodeCount} {text.blocks}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onPreview}
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-3 text-left text-emerald-950 outline-none transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          aria-label={`${text.preview}: ${submission.title}`}
        >
          <span>
            <span className="block text-sm font-semibold">{text.preview}</span>
            <span className="mt-0.5 block text-xs text-emerald-800/70">
              {text.originalLayout} · {nodeCount} {text.blocks}
            </span>
          </span>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-lg text-emerald-700 ring-1 ring-emerald-200"
            aria-hidden="true"
          >
            ↗
          </span>
        </button>
        <div className="mt-4 flex min-h-12 items-start justify-between gap-3 border-t border-slate-100 pt-3">
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
              <p className="mt-1.5 text-xs font-medium text-blue-700">{text.correctionsSaved}</p>
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
  const { language } = useI18n();
  const text = copy[language];
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
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
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="workspace-eyebrow text-emerald-700">
              {text.preview} · {submission.studentName}
            </p>
            <h2 id="diagram-preview-title" className="mt-1 truncate text-xl font-semibold">
              {submission.title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{text.previewHelp}</p>
          </div>
          <div className="flex items-center gap-2">
            {program.functions.length > 0 ? (
              <select
                value={activeDiagramId}
                onChange={(event) => setActiveDiagramId(event.target.value)}
                className={inputClassName}
                aria-label={text.selectDiagram}
              >
                <option value="main">{text.mainDiagram}</option>
                {program.functions.map((flowFunction) => (
                  <option key={flowFunction.id} value={flowFunction.id}>
                    {text.function}: {flowFunction.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className={iconButtonClassName}
              aria-label={text.close}
              title={text.close}
            >
              ×
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 bg-slate-100">
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
              className="flow-editor-canvas bg-slate-100 [&_.react-flow__node]:pointer-events-none"
              attributionPosition="bottom-right"
            >
              <Background variant={BackgroundVariant.Lines} color="#e2e8f0" gap={24} />
              <Controls
                position="bottom-left"
                showInteractive={false}
                className="!rounded-lg !border !border-slate-300 !bg-white !shadow-md [&_button]:!border-slate-200"
              />
              <MiniMap<FlowEditorNode>
                position="bottom-right"
                nodeColor={(node) => getPreviewNodeColor(node.type)}
                pannable
                zoomable
                className="!rounded-lg !border !border-slate-300 !bg-white !shadow-md"
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
  const { language } = useI18n();
  const className =
    difficulty === "dificil"
      ? "bg-red-50 text-red-700 ring-red-200"
      : difficulty === "media"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>
      {difficulty === "dificil"
        ? language === "es"
          ? "Difícil"
          : "Hard"
        : difficulty === "media"
          ? language === "es"
            ? "Media"
            : "Medium"
          : language === "es"
            ? "Fácil"
            : "Easy"}
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
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : tone === "danger"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : "bg-slate-50 text-slate-500 ring-slate-200";

  return (
    <article className="workspace-panel flex items-center justify-between gap-4 p-5">
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-950">
          {value}
        </p>
      </div>
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${className}`}
      >
        <AdminIcon
          name={tone === "success" ? "check" : tone === "danger" ? "attention" : "clock"}
          className="h-5 w-5"
        />
      </span>
    </article>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="col-span-full flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400">
        <AdminIcon name="search" className="h-5 w-5" />
      </span>
      <p className="text-sm text-slate-500">{label}</p>
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
  const { language } = useI18n();
  const text =
    language === "es"
      ? {
          eyebrow: "Revisión docente",
          title: "Correcciones y comentarios",
          help: "Explica qué debe corregir el estudiante y cómo puede mejorar su solución.",
          status: "Estado de la revisión",
          feedback: "Comentarios para el estudiante",
          placeholder:
            "Ejemplo: El ciclo termina una iteración antes. Revisa la condición y vuelve a ejecutar el caso que falló.",
          save: "Guardar correcciones",
        }
      : {
          eyebrow: "Teacher review",
          title: "Corrections and feedback",
          help: "Explain what the student should change and how they can improve their solution.",
          status: "Review status",
          feedback: "Feedback for the student",
          placeholder:
            "Example: The loop stops one iteration early. Review the condition and run the failed test again.",
          save: "Save corrections",
        };

  return (
    <form
      action={updateSubmissionReviewAction}
      className="workspace-panel grid min-w-0 self-start gap-4 p-4 sm:p-5"
    >
      <input name="submissionId" type="hidden" value={submissionId} />
      <div>
        <p className="workspace-eyebrow text-emerald-700">{text.eyebrow}</p>
        <h2 className="mt-2 text-sm font-semibold text-slate-900">{text.title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{text.help}</p>
      </div>
      <label className="text-sm font-semibold text-slate-800">
        {text.status}
        <select name="status" className={`${inputClassName} mt-2 w-full`} defaultValue={status}>
          <option value="submitted">{statusLabels[language].submitted}</option>
          <option value="approved">{statusLabels[language].approved}</option>
          <option value="incomplete">{statusLabels[language].incomplete}</option>
          <option value="rejected">{statusLabels[language].rejected}</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-800">
        {text.feedback}
        <textarea
          name="feedback"
          className={`${inputClassName} mt-2 min-h-36 w-full resize-y`}
          defaultValue={feedback ?? ""}
          placeholder={text.placeholder}
        />
      </label>
      <button className={primaryButtonClassName}>{text.save}</button>
    </form>
  );
}

export function TestResultPanel({
  result,
}: {
  result: import("@/lib/flow-test-runner").ExerciseTestRunResult | null;
}) {
  const { language } = useI18n();
  const text =
    language === "es"
      ? {
          title: "Resultados de las pruebas",
          empty: "Esta entrega todavía no tiene resultados de pruebas automáticas.",
          passed: "aprobadas",
          allPassed: "Todas las pruebas aprobadas",
          attention: "por corregir",
          casePassed: "Aprobado",
          caseFailed: "Fallido",
          expected: "Salida esperada",
          actual: "Salida obtenida",
          error: "Error",
        }
      : {
          title: "Test results",
          empty: "This submission has no automatic test results yet.",
          passed: "passed",
          allPassed: "All tests passed",
          attention: "need attention",
          casePassed: "Passed",
          caseFailed: "Failed",
          expected: "Expected output",
          actual: "Actual output",
          error: "Error",
        };

  if (!result) {
    return (
      <section className={`${panelClassName} min-w-0`}>
        <PanelTitle>{text.title}</PanelTitle>
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm leading-6 text-slate-500">
          {text.empty}
        </p>
      </section>
    );
  }

  return (
    <section className={`${panelClassName} min-w-0`}>
      <PanelTitle>{text.title}</PanelTitle>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-800">
          <span className="tabular-nums">
            {result.passedCount}/{result.total}
          </span>{" "}
          {text.passed}
        </p>
        <span
          className={`text-xs font-semibold ${result.passed ? "text-emerald-700" : "text-rose-700"}`}
        >
          {result.passed
            ? text.allPassed
            : `${result.total - result.passedCount} ${text.attention}`}
        </span>
      </div>
      <div className="mt-3 grid min-w-0 gap-3">
        {result.cases.map((testCase) => (
          <article
            key={testCase.name}
            className={`min-w-0 rounded-xl border p-4 ${testCase.passed ? "border-emerald-100 bg-emerald-50/40" : "border-rose-100 bg-rose-50/40"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-900">
                {testCase.name}
              </p>
              <span
                className={
                  testCase.passed
                    ? "workspace-pill shrink-0 border border-emerald-100 bg-white text-emerald-700"
                    : "workspace-pill shrink-0 border border-rose-100 bg-white text-rose-700"
                }
              >
                {testCase.passed ? text.casePassed : text.caseFailed}
              </span>
            </div>
            <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[11px] font-medium text-slate-500">{text.expected}</dt>
                <dd className="mt-1 whitespace-pre-wrap font-mono text-xs leading-5 text-slate-700 [overflow-wrap:anywhere]">
                  {testCase.expectedOutputs.join("\n") || "—"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-medium text-slate-500">{text.actual}</dt>
                <dd className="mt-1 whitespace-pre-wrap font-mono text-xs leading-5 text-slate-700 [overflow-wrap:anywhere]">
                  {testCase.actualOutputs.join("\n") || "—"}
                </dd>
              </div>
            </dl>
            {!testCase.passed && testCase.message ? (
              <p className="mt-3 rounded-lg border border-rose-100 bg-white/80 px-3 py-2 text-xs leading-5 text-rose-800 [overflow-wrap:anywhere]">
                <span className="font-semibold">{text.error}:</span> {testCase.message}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminChrome({ children, user }: AdminChromeProps) {
  const { language } = useI18n();
  const text = copy[language];
  const pathname = usePathname();
  const navItems = [
    {
      href: "/admin/submissions",
      label: text.submissions,
      icon: "submissions",
      roles: ["teacher", "admin"],
    },
    {
      href: "/admin/users",
      label: text.users,
      icon: "users",
      roles: ["teacher", "admin"],
    },
    {
      href: "/admin/exercises",
      label: text.exercises,
      icon: "exercises",
      roles: ["teacher", "admin"],
    },
    {
      href: "/admin/organizations",
      label: text.organizations,
      icon: "organizations",
      roles: ["admin"],
    },
  ] as const;

  return (
    <div className="app-shell min-h-screen">
      <AppHeader user={user} onLogout={logoutAction} />
      <div className="sticky top-16 z-10 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl sm:top-[72px]">
        <div className="app-header-inner flex min-h-16 items-center justify-between gap-4">
          <nav
            aria-label={language === "es" ? "Administración" : "Administration"}
            className="flex min-w-0 items-center gap-0.5 overflow-x-auto py-3 sm:gap-1"
          >
            {navItems
              .filter((item) => item.roles.some((role) => role === user.role))
              .map((item) => {
                const isActive = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 sm:px-3 sm:text-xs ${
                      isActive
                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <AdminIcon name={item.icon} className="hidden h-4 w-4 sm:block" />
                    {item.label}
                  </Link>
                );
              })}
          </nav>
          <Link href="/" className={`${secondaryButtonClassName} hidden shrink-0 sm:inline-flex`}>
            <AdminIcon name="editor" />
            {text.openEditor}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
      <main className="app-content grid min-w-0 gap-6">{children}</main>
    </div>
  );
}

function PageHeader({
  actions,
  count,
  help,
  title,
}: {
  actions?: ReactNode;
  count: number;
  help: string;
  title: string;
}) {
  const { language } = useI18n();

  return (
    <header className="flex flex-col gap-5 py-1 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <p className="workspace-eyebrow text-emerald-700">
          {language === "es" ? "Administración" : "Administration"}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-500">
            <span className="sr-only">{copy[language].total}: </span>
            {count}
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{help}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-slate-100 pb-3">
      <h2 className="text-sm font-semibold text-slate-800">{children}</h2>
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
    <section className="workspace-panel min-w-0 overflow-hidden p-0">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">
          {count ?? (hasRows && Array.isArray(children) ? children.length : 0)}
        </span>
      </div>
      {toolbar ? <div className="border-b border-slate-100 p-4 sm:p-5">{toolbar}</div> : null}
      <div className="max-h-[calc(100vh-18rem)] overflow-auto">
        <table className="w-full min-w-[1320px] table-fixed text-left text-[13px]">
          {head ? <thead className="sticky top-0 z-10">{head}</thead> : null}
          <tbody>
            {hasRows ? (
              children
            ) : (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-slate-500">
                  {emptyLabel}
                </td>
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
  const { language } = useI18n();
  const className =
    status === "approved"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : status === "incomplete"
        ? "border-yellow-300 bg-yellow-50 text-yellow-900"
        : status === "rejected"
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-slate-300 bg-slate-50 text-slate-700";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {statusLabels[language][status as keyof typeof statusLabels.es] ?? status}
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
  const label = passed === null ? noTestsLabel : passed ? passedLabel : failedLabel;
  const className =
    passed === null
      ? "border-slate-300 bg-slate-50 text-slate-600"
      : passed
        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
        : "border-red-300 bg-red-50 text-red-800";

  return (
    <span
      className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function formatDeadline(value: string) {
  return value.replace("T", " ");
}

const statusLabels = {
  es: {
    submitted: "Por revisar",
    approved: "Aprobada",
    incomplete: "Incompleta",
    rejected: "Rechazada",
  },
  en: {
    submitted: "Awaiting review",
    approved: "Approved",
    incomplete: "Incomplete",
    rejected: "Rejected",
  },
} as const;

const inputClassName = "fc-field min-w-0 font-normal normal-case tracking-normal";

const primaryButtonClassName = "fc-button fc-button--primary";

const secondaryButtonClassName = "fc-button fc-button--secondary";

const panelClassName = "workspace-panel min-w-0 p-4 sm:p-5";

const tableRowClassName = "border-t border-slate-100 transition-colors hover:bg-slate-50/80";

const tableCellClassName = "break-words px-4 py-4 align-top";

const dangerButtonClassName = "fc-button fc-button--danger";

const iconButtonClassName =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xl leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600";
