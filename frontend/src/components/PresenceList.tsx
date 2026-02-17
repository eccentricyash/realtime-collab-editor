import { useEffect, useState } from 'react';
import type { WebsocketProvider } from 'y-websocket';

interface PresenceListProps {
  provider: WebsocketProvider | null;
  currentUsername: string;
}

interface AwarenessUser {
  name: string;
  color: string;
}

export default function PresenceList({ provider, currentUsername }: PresenceListProps) {
  const [users, setUsers] = useState<AwarenessUser[]>([]);

  useEffect(() => {
    if (!provider) return;

    const awareness = provider.awareness;

    const updateUsers = () => {
      const states = awareness.getStates();
      const userList: AwarenessUser[] = [];
      const seen = new Set<string>();

      states.forEach((state) => {
        const user = state.user as AwarenessUser | undefined;
        if (user && user.name && !seen.has(user.name)) {
          seen.add(user.name);
          userList.push(user);
        }
      });

      setUsers(userList);
    };

    awareness.on('change', updateUsers);
    updateUsers();

    return () => {
      awareness.off('change', updateUsers);
    };
  }, [provider]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {users.map((user) => (
          <div
            key={user.name}
            className="relative group"
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 ${
                user.name === currentUsername ? 'border-blue-400' : 'border-white'
              }`}
              style={{ backgroundColor: user.color }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {user.name}{user.name === currentUsername ? ' (you)' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
