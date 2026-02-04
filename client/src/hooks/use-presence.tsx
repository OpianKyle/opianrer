import { useEffect, useRef, useState } from 'react';
import { useAuth } from './use-auth';
import { User } from '@shared/schema';

export function usePresence() {
  const { user } = useAuth();
  const ws = useRef<WebSocket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
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
          
          if (data.type === 'presence_update') {
            setUsers(prevUsers => {
              const updatedUsers = [...prevUsers];
              const userIndex = updatedUsers.findIndex(u => u.id === data.userId);
              
              if (userIndex !== -1) {
                updatedUsers[userIndex] = {
                  ...updatedUsers[userIndex],
                  isOnline: data.isOnline,
                  lastSeen: new Date(data.timestamp)
                };
              }
              
              return updatedUsers;
            });
          } else if (data.type === 'appointment_notification') {
            // Handle appointment notifications
            const notification = data.data;
            if (notification.assignedToId === user?.id) {
              // Add notification to local storage
              const existingNotifications = JSON.parse(localStorage.getItem('notifications') || '[]');
              const newNotification = {
                ...notification,
                id: `appointment_${notification.appointmentId}_${Date.now()}`,
                timestamp: Date.now(),
                read: false
              };
              
              existingNotifications.unshift(newNotification);
              localStorage.setItem('notifications', JSON.stringify(existingNotifications));
              
              // Trigger notification event
              window.dispatchEvent(new CustomEvent('notification', { detail: newNotification }));
              
              // Show browser notification if permission granted
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(notification.title, {
                  body: notification.body,
                  icon: '/favicon.ico'
                });
              }
            }
          }
        } catch (error) {
          console.error('Error parsing presence message:', error);
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

  // Fetch initial users data
  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users/presence');
      if (response.ok) {
        const usersData = await response.json();
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  return {
    users,
    refreshUsers: fetchUsers
  };
}