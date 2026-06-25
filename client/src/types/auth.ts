export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
}

export interface PauseStatus {
  isPaused: boolean;
  pauseReason: string | null;
  openAssignedConversationsCount: number;
}
