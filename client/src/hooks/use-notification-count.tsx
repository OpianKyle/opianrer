import { useState, useEffect } from 'react';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  type: 'appointment' | 'reminder' | 'system' | 'team';
  read: boolean;
  url?: string;
}

export function useNotificationCount() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    // Load notifications from localStorage on initialization
    const saved = localStorage.getItem('opian-notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const [unreadCount, setUnreadCount] = useState(() => {
    // Calculate unread count from loaded notifications
    const saved = localStorage.getItem('opian-notifications');
    if (saved) {
      const parsedNotifications = JSON.parse(saved);
      return parsedNotifications.filter((n: NotificationItem) => !n.read).length;
    }
    return 0;
  });

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('opian-notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Add new notification
  const addNotification = (notification: Omit<NotificationItem, 'id' | 'read' | 'timestamp'>) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      timestamp: Date.now()
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  // Mark notification as read
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
    setUnreadCount(0);
  };

  // Clear all notifications
  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
    // Clear localStorage to prevent notifications from reloading
    localStorage.removeItem('opian-notifications');
    localStorage.removeItem('opian-shown-notifications');
  };

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll
  };
}