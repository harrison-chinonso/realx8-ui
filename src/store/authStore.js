import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { switchRoleApi, enableProfileApi } from '../api/authApi';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: [],
      company_id: null,
      isSuperiorAdmin: false,
      roles: [],        // all roles/profiles this user has
      activeRole: null, // { id, name, display_name } — currently active profile

      setSession: (payloadOrAccessToken, refreshToken, user) => {
        const payload = typeof payloadOrAccessToken === 'object' && payloadOrAccessToken !== null
          ? payloadOrAccessToken
          : { accessToken: payloadOrAccessToken, refreshToken, user };
        const perms = payload.user?.permissions ?? [];
        const u = payload.user ?? null;
        set({
          user: u,
          accessToken: payload.accessToken ?? null,
          refreshToken: payload.refreshToken ?? null,
          permissions: Array.isArray(perms) ? perms : [],
          company_id: u?.company_id ?? null,
          isSuperiorAdmin: u?.type === 'superior_admin' || u?.isSuperiorAdmin === true,
          roles: Array.isArray(payload.roles) ? payload.roles : get().roles,
          activeRole: payload.activeRole !== undefined ? payload.activeRole : get().activeRole,
        });
      },

      logout: () => set({
        user: null,
        accessToken: null,
        refreshToken: null,
        permissions: [],
        company_id: null,
        isSuperiorAdmin: false,
        roles: [],
        activeRole: null,
      }),

      switchRole: async (roleId) => {
        const res = await switchRoleApi(roleId);
        get().setSession(res);
        return res;
      },

      /** Adds the counterpart realtor/client profile and switches into it. */
      enableProfile: async (profile) => {
        const res = await enableProfileApi(profile);
        get().setSession(res);
        return res;
      },

      /**
       * The profile the user is currently ACTING as. Falls back to the static
       * account type when the active role is not a switchable profile.
       * Gate role-specific UI on this, never on user.type.
       */
      effectiveType: () => {
        const { user, activeRole } = get();
        const name = activeRole?.name;
        return ['realtor', 'client'].includes(name) ? name : (user?.type ?? null);
      },

      hasPermission: (perm) => {
        if (!perm) return true;
        // superior_admin has unrestricted access
        if (get().isSuperiorAdmin) return true;
        const perms = get().permissions;
        return perms.includes(perm) || perms.includes('*');
      },

      isSuperiorAdminUser: () => get().isSuperiorAdmin,
    }),
    { name: 'realto-auth' }
  )
);

export default useAuthStore;
