import useAuthStore from '../../store/authStore';

export default function PermissionGate({ permission, anyOf, children, fallback = null }) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const allowed = anyOf
    ? anyOf.some(hasPermission)
    : hasPermission(permission);
  return allowed ? children : fallback;
}
