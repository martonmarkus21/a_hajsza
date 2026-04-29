import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';
import { apiUrl } from '@/config/env';

interface GameInfo {
  isGameActive: boolean;
  currentTime: string;
  gameStartTime: string | null;
  gameEndTime: string | null;
  activeGameArea: string | null;
  activePairs: number;
  totalPairs: number;
  /** Backend JSON: `campaignStatus` — a játékmotor fázisa (pl. RUNNING). */
  campaignStatus?: string | null;
  currentIntervalMinutes?: number | null;
  /** Utolsó játéknap ütemezett zárása után (backend). */
  isPastLastScheduledGameEnd?: boolean;
}

export function useGameInfo() {
  const { socket } = useSocket();
  const [gameInfo, setGameInfo] = useState<GameInfo>({
    isGameActive: false,
    currentTime: new Date().toLocaleTimeString('hu-HU'),
    gameStartTime: null,
    gameEndTime: null,
    activeGameArea: null,
    activePairs: 0,
    totalPairs: 0,
    campaignStatus: null,
    currentIntervalMinutes: null,
    isPastLastScheduledGameEnd: false,
  });

  const fetchGameInfo = async () => {
    try {
      // Fetch game day info
      let gameDay = null;
      try {
        const gameDayResponse = await fetch(apiUrl('/api/game-days/today'), {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (gameDayResponse.ok) {
          const text = await gameDayResponse.text();
          if (text && text.trim()) {
            gameDay = JSON.parse(text);
          }
        }
      } catch (error) {
        console.error('Error fetching game day:', error);
      }

      let runtimeInfo: any = null;
      try {
        const runtimeResponse = await fetch(apiUrl('/api/game-settings/countdown'), {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (runtimeResponse.ok) {
          const text = await runtimeResponse.text();
          if (text && text.trim()) {
            runtimeInfo = JSON.parse(text);
          }
        }
      } catch (error) {
        console.error('Error fetching runtime info:', error);
      }

      // Fetch game area
      let gameArea = null;
      try {
        const gameAreaResponse = await fetch(apiUrl('/api/game-area'), {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (gameAreaResponse.ok) {
          const text = await gameAreaResponse.text();
          if (text && text.trim()) {
            gameArea = JSON.parse(text);
          }
        }
      } catch (error) {
        console.error('Error fetching game area:', error);
      }

      // Fetch pairs
      let pairsData = { pairs: [] };
      try {
        const pairsResponse = await fetch(apiUrl('/api/pairs?active=true'), {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (pairsResponse.ok) {
          const text = await pairsResponse.text();
          if (text && text.trim()) {
            pairsData = JSON.parse(text);
          }
        }
      } catch (error) {
        console.error('Error fetching pairs:', error);
      }

      const now = new Date();
      const currentTime = now.toLocaleTimeString('hu-HU');
      const isGameActive = runtimeInfo?.isGameActive === true;

      // Get active game area - use the activeGameArea from API if available, otherwise find all active geofences
      let activeGameArea: string | null = null;
      if (gameArea?.activeGameArea) {
        activeGameArea = gameArea.activeGameArea;
      }

      // Also check for active custom zones via direct geofence fetch
      try {
        const geofenceResponse = await fetch(apiUrl('/api/geofence'), {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (geofenceResponse.ok) {
          const allGeofences = await geofenceResponse.json();
          const activeGeofences = allGeofences.filter((g: any) => g.active);
          if (activeGeofences.length > 0) {
            activeGameArea = activeGeofences.map((g: any) => g.name).join(', ');
          }
        }
      } catch (error) {
        console.error('Error fetching geofences for game info:', error);
      }

      setGameInfo({
        isGameActive,
        currentTime,
        gameStartTime: gameDay?.startTime || null,
        gameEndTime: gameDay?.endTime || null,
        activeGameArea: activeGameArea,
        activePairs: pairsData.pairs?.length || 0,
        totalPairs: pairsData.pairs?.length || 0,
        campaignStatus: runtimeInfo?.campaignStatus || null,
        currentIntervalMinutes:
          typeof runtimeInfo?.currentIntervalMinutes === 'number'
            ? runtimeInfo.currentIntervalMinutes
            : null,
        isPastLastScheduledGameEnd: runtimeInfo?.isPastLastScheduledGameEnd === true,
      });
    } catch (error) {
      console.error('Error fetching game info:', error);
    }
  };

  useEffect(() => {
    fetchGameInfo();
    const interval = setInterval(fetchGameInfo, 30000);
    const timeInterval = setInterval(() => {
      setGameInfo((prev) => ({
        ...prev,
        currentTime: new Date().toLocaleTimeString('hu-HU'),
      }));
    }, 1000); // Update time every second

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, []);

  // Játéktér vagy játékmotor (ütemezés / ciklus) változásakor azonnali frissítés
  useEffect(() => {
    if (!socket) return;

    const handleGameAreaUpdate = () => {
      void fetchGameInfo();
    };

    const handleGameRuntimeUpdate = () => {
      void fetchGameInfo();
    };

    socket.on('gameAreaUpdate', handleGameAreaUpdate);
    socket.on('gameRuntimeUpdate', handleGameRuntimeUpdate);

    return () => {
      socket.off('gameAreaUpdate', handleGameAreaUpdate);
      socket.off('gameRuntimeUpdate', handleGameRuntimeUpdate);
    };
  }, [socket]);

  return gameInfo;
}

