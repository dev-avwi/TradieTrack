const AVATAR_COLORS = [
  { bg: '#6366f1', fg: '#ffffff' },
  { bg: '#8b5cf6', fg: '#ffffff' },
  { bg: '#ec4899', fg: '#ffffff' },
  { bg: '#f43f5e', fg: '#ffffff' },
  { bg: '#f97316', fg: '#ffffff' },
  { bg: '#eab308', fg: '#422006' },
  { bg: '#22c55e', fg: '#ffffff' },
  { bg: '#14b8a6', fg: '#ffffff' },
  { bg: '#06b6d4', fg: '#ffffff' },
  { bg: '#3b82f6', fg: '#ffffff' },
  { bg: '#a855f7', fg: '#ffffff' },
  { bg: '#d946ef', fg: '#ffffff' },
];

export function getAvatarColor(name: string): { bg: string; fg: string } {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName.substring(0, 2).toUpperCase();
  if (email) return email.substring(0, 2).toUpperCase();
  return '??';
}
