import { useState, useEffect } from 'react';
import { notificationService, NotificationData } from '@/lib/notifications';

export interface UseNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isInitialized: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  showNotification: (data: NotificationData) => void;
  showAppointmentReminder: (appointment: any) => void;
  showNewAppointment: (appointment: any) => void;
  showClientUpdate: (clientName: string, message: string) => void;
  showSystemNotification: (title: string, message: string) => void;
  scheduleAppointmentReminders: (appointments: any[]) => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize notification service
    const initializeNotifications = async () => {
      const supported = notificationService.isSupported();
      setIsSupported(supported);
      
      if (supported) {
        const initialized = await notificationService.initialize();
        setIsInitialized(initialized);
        setPermission(notificationService.getPermissionStatus());
      }
    };

    initializeNotifications();
  }, []);

  const requestPermission = async (): Promise<NotificationPermission> => {
    const newPermission = await notificationService.requestPermission();
    setPermission(newPermission);
    return newPermission;
  };

  const showNotification = (data: NotificationData): void => {
    if (permission === 'granted') {
      notificationService.showNotification(data);
    } else {
      console.warn('Notification permission not granted. Current permission:', permission);
    }
  };

  const showAppointmentReminder = (appointment: any): void => {
    notificationService.showAppointmentReminder(appointment);
  };

  const showNewAppointment = (appointment: any): void => {
    notificationService.showNewAppointment(appointment);
  };

  const showClientUpdate = (clientName: string, message: string): void => {
    notificationService.showClientUpdate(clientName, message);
  };

  const showSystemNotification = (title: string, message: string): void => {
    notificationService.showSystemNotification(title, message);
  };

  const scheduleAppointmentReminders = (appointments: any[]): void => {
    notificationService.scheduleAppointmentReminders(appointments);
  };

  return {
    isSupported,
    permission,
    isInitialized,
    requestPermission,
    showNotification,
    showAppointmentReminder,
    showNewAppointment,
    showClientUpdate,
    showSystemNotification,
    scheduleAppointmentReminders
  };
}