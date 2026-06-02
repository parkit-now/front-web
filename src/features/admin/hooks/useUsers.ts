import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { translateApiError } from '../../../lib/api/translate';
import { useToast } from '../../../lib/notifications/ToastProvider';
import {
  addMembership,
  deleteUser,
  getUser,
  listUsers,
  removeMembership,
  updateMembership,
  updateUserRole,
  type AdminUser,
  type AdminUserMembership,
  type CreateMembershipInput,
  type ListUsersParams,
  type MembershipRole,
  type UserRole,
} from '../services/users';

const ADMIN_USERS_KEY = ['admin', 'users'] as const;

/** Paginated, searchable user list. */
export function useUsersList(params: ListUsersParams) {
  return useQuery({
    queryKey: [...ADMIN_USERS_KEY, 'list', params],
    queryFn: () => listUsers(params),
  });
}

/** Full user detail (identity + memberships); disabled when no id is selected. */
export function useUserDetail(id: string | null) {
  return useQuery({
    queryKey: [...ADMIN_USERS_KEY, 'detail', id],
    queryFn: () => getUser(id as string),
    enabled: id !== null,
  });
}

type UpdateRoleArgs = { id: string; role: UserRole };

export type UseUserActionsResult = {
  updateRoleMutation: UseMutationResult<AdminUser, unknown, UpdateRoleArgs>;
  deleteMutation: UseMutationResult<void, unknown, string>;
};

/** Global-role and deletion mutations for a user. */
export function useUserActions(): UseUserActionsResult {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
  };

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: UpdateRoleArgs) => updateUserRole(id, role),
    onSuccess: () => {
      invalidate();
      showToast({ message: 'Rol actualizado.', kind: 'success' });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'admin.users.updateRole',
        }),
        kind: 'error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      invalidate();
      showToast({ message: 'Usuario eliminado.', kind: 'success' });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, { endpoint: 'admin.users.delete' }),
        kind: 'error',
      });
    },
  });

  return { updateRoleMutation, deleteMutation };
}

type AddMembershipArgs = { userId: string; body: CreateMembershipInput };
type UpdateMembershipArgs = {
  userId: string;
  parkingId: string;
  role: MembershipRole;
};
type RemoveMembershipArgs = { userId: string; parkingId: string };

export type UseMembershipActionsResult = {
  addMutation: UseMutationResult<
    AdminUserMembership,
    unknown,
    AddMembershipArgs
  >;
  updateMutation: UseMutationResult<
    AdminUserMembership,
    unknown,
    UpdateMembershipArgs
  >;
  removeMutation: UseMutationResult<void, unknown, RemoveMembershipArgs>;
};

/** Membership (user↔parking role) mutations that refresh the user detail. */
export function useMembershipActions(): UseMembershipActionsResult {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
  };

  const addMutation = useMutation({
    mutationFn: ({ userId, body }: AddMembershipArgs) =>
      addMembership(userId, body),
    onSuccess: () => {
      invalidate();
      showToast({ message: 'Relación agregada.', kind: 'success' });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'admin.users.addMembership',
        }),
        kind: 'error',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, parkingId, role }: UpdateMembershipArgs) =>
      updateMembership(userId, parkingId, { role }),
    onSuccess: () => {
      invalidate();
      showToast({
        message: 'Rol de la relación actualizado.',
        kind: 'success',
      });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'admin.users.updateMembership',
        }),
        kind: 'error',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ userId, parkingId }: RemoveMembershipArgs) =>
      removeMembership(userId, parkingId),
    onSuccess: () => {
      invalidate();
      showToast({ message: 'Relación eliminada.', kind: 'success' });
    },
    onError: (error) => {
      showToast({
        message: translateApiError(error, {
          endpoint: 'admin.users.removeMembership',
        }),
        kind: 'error',
      });
    },
  });

  return { addMutation, updateMutation, removeMutation };
}
