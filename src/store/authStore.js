import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  switchRoleApi, enableProfileApi, switchCompanyApi, logout as logoutApi,
} from '../api/authApi';
import { setSessionKey, clearSessionKey } from '../api/payloadCrypto';
import { resetRefreshBudget } from '../api/refreshBudget';
import { markFreshLogin } from '../lib/launcherGreeting';
import { clearBrowserState } from '../lib/clearBrowserState';

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

      /**
       * The companies this person holds an account with.
       *
       * Empty for anybody who can only hold one — which is every kind of staff
       * — and that emptiness is the signal the switcher reads: a list with one
       * entry in it would be a control that does nothing.
       *
       * It arrives with the session rather than being fetched, so the switcher
       * is right from the first paint instead of appearing a moment later.
       */
      companies: [],

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

        /*
         * A session starting where there wasn't one — which is to say, a sign
         * in. The launcher template opens its menu on the back of this.
         *
         * The test is "was there a user a moment ago", NOT "did a token
         * arrive". Every one of these sends a token: the silent refresh in
         * client.js, saving your profile, saving company settings. Only a sign
         * in, a registration or an OAuth callback arrives with nobody signed in
         * yet, which is what distinguishes it from the other five callers
         * without any of them having to say so.
         */
        if (!get().user && u) {
          /*
           * Order matters. The wipe goes FIRST, so that everything written
           * after it — the greeting flag just below, and this store's own
           * persisted copy of the new session a moment later — belongs to the
           * session starting now rather than being cleared along with the one
           * that ended.
           */
          clearBrowserState();
          markFreshLogin();
        }

        set({
          user: u,
          accessToken: payload.accessToken ?? null,
          refreshToken: payload.refreshToken ?? null,
          permissions: Array.isArray(perms) ? perms : [],
          company_id: u?.company_id ?? null,
          isSuperiorAdmin: u?.type === 'superior_admin' || u?.isSuperiorAdmin === true,
          roles: Array.isArray(payload.roles) ? payload.roles : get().roles,
          activeRole: payload.activeRole !== undefined ? payload.activeRole : get().activeRole,
          companies: Array.isArray(payload.companies) ? payload.companies : get().companies,
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
        companies: [],
        });
      },

      switchRole: async (roleId) => {
        const res = await switchRoleApi(roleId);
        get().setSession(res);
        return res;
      },

      /**
       * Move to this person's account at another company.
       *
       * It goes through setSession like a sign-in does, because that is what it
       * is: a different account, with different permissions, a different
       * profile and possibly different branding. Patching a company id into the
       * session in place would leave the permissions of the company just left.
       *
       * The appearance is NOT refreshed here. AppearanceContext already watches
       * the token and the company id and re-reads on either changing, so doing
       * it here as well would fire the same request twice on every switch — see
       * the comment there about why that watch exists.
       */
      switchCompany: async (companyId) => {
        const res = await switchCompanyApi(companyId);
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
