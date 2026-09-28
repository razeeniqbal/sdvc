import { useOutletContext } from 'react-router-dom';
import type { AdminSession } from '@/lib/adminSessions';

export interface SessionWorkspaceContext {
  session: AdminSession;
  waitingCount: number;
  reload: () => Promise<void>;
}

export function useSessionWorkspace() {
  return useOutletContext<SessionWorkspaceContext>();
}

