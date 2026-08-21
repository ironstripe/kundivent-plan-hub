import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  createUser,
  deleteUser,
  listUsers,
  resetUserPassword,
  setUserActive,
  updateUser,
} from "./users.functions";

export type Profile = Tables<"profiles">;

export const myProfileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: async (): Promise<Profile | null> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  },
});

export function useMyProfile() {
  return useQuery(myProfileQuery);
}

export const usersQuery = queryOptions({
  queryKey: ["managed-users"],
  queryFn: () => listUsers(),
});

export function useUsers(enabled: boolean) {
  return useQuery({ ...usersQuery, enabled });
}

function useUsersMutation<TInput, TResult>(fn: (data: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-users"] });
    },
  });
}

export function useCreateUser() {
  return useUsersMutation(
    (data: {
      email: string;
      password: string;
      display_name: string;
      active: boolean;
      is_admin: boolean;
    }) => createUser({ data }),
  );
}

export function useUpdateUser() {
  return useUsersMutation(
    (data: {
      id: string;
      email: string;
      display_name: string;
      active: boolean;
      is_admin: boolean;
    }) => updateUser({ data }),
  );
}

export function useSetUserActive() {
  return useUsersMutation((data: { id: string; active: boolean }) => setUserActive({ data }));
}

export function useResetUserPassword() {
  return useUsersMutation((data: { id: string; password: string }) => resetUserPassword({ data }));
}

export function useDeleteUser() {
  return useUsersMutation((data: { id: string }) => deleteUser({ data }));
}
