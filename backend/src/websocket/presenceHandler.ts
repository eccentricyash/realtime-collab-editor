const PRESENCE_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
  '#6366F1', '#06B6D4', '#84CC16', '#E11D48',
];

export function getColorForUser(index: number): string {
  return PRESENCE_COLORS[index % PRESENCE_COLORS.length];
}

export interface UserPresence {
  userId: string;
  username: string;
  color: string;
  cursor?: { anchor: number; head: number } | null;
}
