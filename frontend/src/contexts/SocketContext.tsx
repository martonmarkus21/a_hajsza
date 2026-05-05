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
    window.addEventListener('ck:auth-token-changed', onAuth);
    return () => window.removeEventListener('ck:auth-token-changed', onAuth);
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

    /** React 18 Strict Mode lefuttatja a mount→cleanup→mount ciklust: ha itt azonnal `io()`, az első socket „félbemarad” és zajos WS-hibát ír a konzolra. */
    let socketInstance: Socket | null = null;
    const scheduleId = window.setTimeout(() => {
      if (readToken() !== token) return;
      const s = io(WS_GAME_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });
      socketInstance = s;

      s.on('connect', () => {
        setConnected(true);
        s.emit('subscribe:positions');
      });
      s.on('disconnect', () => setConnected(false));

      setSocket(s);
    }, 0);

    return () => {
      window.clearTimeout(scheduleId);
      if (socketInstance) {
        socketInstance.removeAllListeners();
        socketInstance.close();
        socketInstance = null;
      }
      setSocket(null);
      setConnected(false);
    };
  }, [tokenEpoch]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
