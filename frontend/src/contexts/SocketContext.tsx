import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS_GAME_URL } from '@/config/env';

type SocketContextValue = {
  socket: Socket | null;
  connected: boolean;
};

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

function readToken(): string | null {
  return localStorage.getItem('token');
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [tokenEpoch, setTokenEpoch] = useState(0);

  useEffect(() => {
    const onAuth = () => setTokenEpoch((n) => n + 1);
    window.addEventListener('mw:auth-token-changed', onAuth);
    return () => window.removeEventListener('mw:auth-token-changed', onAuth);
  }, []);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setSocket((prev) => {
        if (prev) prev.close();
        return null;
      });
      setConnected(false);
      return;
    }

    const s = io(WS_GAME_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    s.on('connect', () => {
      setConnected(true);
      s.emit('subscribe:positions');
    });
    s.on('disconnect', () => setConnected(false));

    setSocket(s);

    return () => {
      s.removeAllListeners();
      s.close();
      setConnected(false);
    };
  }, [tokenEpoch]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
