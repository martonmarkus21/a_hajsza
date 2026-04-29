import { useState, useEffect } from 'react';
import { Pair } from '../types';
import { apiUrl } from '@/config/env';

export function usePairs() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPairs();
    const interval = setInterval(fetchPairs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchPairs = async () => {
    try {
      const response = await fetch(apiUrl('/api/pairs'), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch pairs');
      }
      const data = await response.json();
      setPairs(data.pairs);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pairs:', error);
      setLoading(false);
    }
  };

  return { pairs, loading, refetch: fetchPairs };
}

