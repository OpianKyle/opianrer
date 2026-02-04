import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';

export default function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const ws = useRef<WebSocket | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const connectWebSocket = () => {
      // Create WebSocket connection
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('Presence WebSocket connected');
        
        // Send join message
        ws.current?.send(JSON.stringify({
          type: 'join',
          userId: user.id
        }));

        // Start heartbeat
        heartbeatInterval.current = setInterval(() => {
          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'heartbeat'
            }));
          }
        }, 30000); // Send heartbeat every 30 seconds
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification' && data.data) {
            // Handle notifications and dispatch custom event
            const notificationData = data.data;
            const customEvent = new CustomEvent('notification', { 
              detail: {
                title: notificationData.title,
                body: notificationData.body,
                type: notificationData.type || 'system',
                url: notificationData.url,
                requirePush: notificationData.requirePush
              }
            });
            window.dispatchEvent(customEvent);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('Presence WebSocket disconnected');
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (user) {
            console.log('Attempting to reconnect WebSocket...');
            connectWebSocket();
          }
        }, 3000);
      };

      ws.current.onerror = (error) => {
        console.error('Presence WebSocket error:', error);
      };
    };

    connectWebSocket();

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [user]);

  return <>{children}</>;
}