import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { switchRoleApi, enableProfileApi, logout as logoutApi } from '../api/authApi';
import { setSessionKey, clearSessionKey } from '../api/payloadCrypto';
import { resetRefreshBudget } from '../api/refreshBudget';

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

        /**
         * The payload key goes to the crypto module, NOT into this store.
         *
         * This store is persisted to localStorage, and a key written there
         * would outlive the tab and be readable by anything with DOM access —
         * which would give away the one advantage a per-session key has over a
         * key shipped in the bundle. It is held in memory and re-fetched after
         * a reload.
         *
         * Only set when the response actually carried one: switchRole and
         * enableProfile both mint a new session and do send it, but a caller
         * that passes a partial payload must not silently wipe the key.
         */
        if (payload.payloadKey !== undefined) setSessionKey(payload.payloadKey);
        // A new session starts with a clean refresh budget, so a previous
        // session's loop cannot end this one early.
        if (payload.accessToken) resetRefreshBudget();
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

      /**
       * Signing out, locally and on the server.
       *
       * The server call was missing entirely: every layout's logout button
       * cleared this store and nothing else, so POST /auth/logout — which
       * deletes the refresh token and releases the single-sign-in hold — was
       * never reached by anything. The refresh token stayed valid for its full
       * seven days, and a user who signed out could be refused a fresh sign-in
       * by their own abandoned session.
       *
       * It is deliberately fire-and-forget. Local state is cleared FIRST and
       * unconditionally: a user who clicks Logout must end up signed out even
       * if the network is down or their token has already expired. Waiting on
       * the request, or letting it throw, would mean a failed call leaves them
       * apparently still signed in — which is the worst outcome of the three.
       */
      logout: () => {
        const { refreshToken } = get();
        clearSessionKey();
        if (refreshToken) {
          logoutApi(refreshToken).catch(() => {
            // Already expired, revoked, or unreachable. The session is over
            // locally either way, and the refresh token expires on its own.
          });
        }
        return set({
        user: null,
        accessToken: null,
        refreshToken: null,
        permissions: [],
        company_id: null,
        isSuperiorAdmin: false,
        roles: [],
        activeRole: null,
        });
      },

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
