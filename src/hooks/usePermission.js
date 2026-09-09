import useAuthStore from '../store/authStore';

export const usePermission = (permission) => {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  return hasPermission(permission);
};

export const usePermissions = () => useAuthStore((state) => state.permissions);

export const useHasAnyPermission = (permissions) => {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  return permissions.some(hasPermission);
};
