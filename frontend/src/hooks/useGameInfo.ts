import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';

interface GameInfo {
  isGameActive: boolean;
  currentTime: string;
  gameStartTime: string | null;
  gameEndTime: string | null;
  activeGameArea: string | null;
  activePairs: number;
  totalPairs: number;
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
  });

  const fetchGameInfo = async () => {
      try {
        // Fetch game day info
        let gameDay = null;
        try {
          const gameDayResponse = await fetch('http://localhost:3000/api/game-days/today', {
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

        // Fetch game area
        let gameArea = null;
        try {
          const gameAreaResponse = await fetch('http://localhost:3000/api/game-area', {
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
          const pairsResponse = await fetch('http://localhost:3000/api/pairs?active=true', {
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
        const isGameActive = gameDay
          ? (() => {
              const [startHour, startMin] = gameDay.startTime.split(':').map(Number);
              const [endHour, endMin] = gameDay.endTime.split(':').map(Number);
              const currentMinutes = now.getHours() * 60 + now.getMinutes();
              const startMinutes = startHour * 60 + startMin;
              const endMinutes = endHour * 60 + endMin;
              return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
            })()
          : false;

        // Get active game area - use the activeGameArea from API if available, otherwise find active geofences
        let activeGameArea: string | null = null;
        if (gameArea?.activeGameArea) {
          activeGameArea = gameArea.activeGameArea;
        } else if (gameArea?.geofences) {
          const activeGeofences = gameArea.geofences.filter((g: any) => g.active && g.geofenceType === 'game_area');
          if (activeGeofences.length > 0) {
            activeGameArea = activeGeofences.map((g: any) => g.name).join(', ');
          }
        }

        setGameInfo({
          isGameActive,
          currentTime,
          gameStartTime: gameDay?.startTime || null,
          gameEndTime: gameDay?.endTime || null,
          activeGameArea: activeGameArea,
          activePairs: pairsData.pairs?.length || 0,
          totalPairs: pairsData.pairs?.length || 0,
        });
      } catch (error) {
        console.error('Error fetching game info:', error);
      }
    };

  useEffect(() => {
    fetchGameInfo();
    const interval = setInterval(fetchGameInfo, 60000); // Update every minute
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

  // Listen for game area updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleGameAreaUpdate = () => {
      console.log('Game area update received, refreshing game info...');
      fetchGameInfo();
    };

    socket.on('gameAreaUpdate', handleGameAreaUpdate);

    return () => {
      socket.off('gameAreaUpdate', handleGameAreaUpdate);
    };
  }, [socket]);

  return gameInfo;
}

