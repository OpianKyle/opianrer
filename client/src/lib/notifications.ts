// Notification utilities and service
export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  id?: string;
  timestamp?: number;
  type?: 'appointment' | 'reminder' | 'system' | 'team' | 'client';
}

export class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = 'default';

  private constructor() {
    this.permission = Notification.permission;
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Initialize notification service
  async initialize(): Promise<boolean> {
    try {
      // Check if browser supports notifications
      if (!('Notification' in window)) {
        console.warn('This browser does not support notifications');
        return false;
      }

      // Update permission status
      this.permission = Notification.permission;
      console.log('Notification service initialized successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      return false;
    }
  }

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (this.permission === 'granted') {
      return this.permission;
    }

    try {
      this.permission = await Notification.requestPermission();
      return this.permission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  }

  // Show local notification
  async showNotification(data: NotificationData): Promise<void> {
    if (this.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      const options: NotificationOptions = {
        body: data.body,
        icon: data.icon || '/favicon.ico',
        tag: data.id || 'default',
        timestamp: data.timestamp || Date.now(),
        data: {
          url: data.url,
          type: data.type,
          id: data.id
        }
      };

      const notification = new Notification(data.title, options);
      
      if (data.url) {
        notification.onclick = () => {
          window.focus();
          window.location.href = data.url;
          notification.close();
        };
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  // Schedule notification for future
  scheduleNotification(data: NotificationData, delay: number): void {
    setTimeout(() => {
      this.showNotification(data);
    }, delay);
  }

  // Show appointment reminder
  showAppointmentReminder(appointment: {
    title: string;
    date: string;
    time: string;
    client?: string;
  }): void {
    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString();
    
    this.showNotification({
      title: 'Appointment Reminder',
      body: `${appointment.title} with ${appointment.client || 'client'} on ${formattedDate} at ${appointment.time}`,
      type: 'appointment',
      url: '/appointments',
      id: `appointment-${Date.now()}`
    });
  }

  // Show new appointment notification
  showNewAppointment(appointment: {
    title: string;
    date: string;
    time: string;
    teamMember?: string;
  }): void {
    const notificationData = {
      title: 'New Meeting Scheduled',
      body: `${appointment.title} has been scheduled for ${appointment.date} at ${appointment.time}${appointment.teamMember ? ` with ${appointment.teamMember}` : ''}`,
      type: 'appointment' as const,
      url: '/appointments',
      id: `new-appointment-${Date.now()}`
    };
    
    // Add to context
    if (addNotificationToContext) {
      addNotificationToContext(notificationData);
    }
    
    // Show push notification
    this.showNotification(notificationData);
  }

  // Show team member update notification
  showTeamMemberUpdate(teamMemberName: string, message: string): void {
    const notificationData = {
      title: 'Team Member Update',
      body: `${teamMemberName}: ${message}`,
      type: 'team' as const,
      url: '/team-members',
      id: `team-update-${Date.now()}`
    };
    
    // Add to context
    if (addNotificationToContext) {
      addNotificationToContext(notificationData);
    }
    
    // Show push notification
    this.showNotification(notificationData);
  }

  // Show system notification
  showSystemNotification(title: string, message: string): void {
    this.showNotification({
      title,
      body: message,
      type: 'system',
      url: '/dashboard',
      id: `system-${Date.now()}`
    });
  }

  // Check if notifications are supported
  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  // Get current permission status
  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  // Schedule appointment reminders
  scheduleAppointmentReminders(appointments: Array<{
    id: number;
    title: string;
    date: string;
    time: string;
    client?: string;
  }>): void {
    appointments.forEach(appointment => {
      const appointmentDateTime = new Date(`${appointment.date} ${appointment.time}`);
      const now = new Date();
      
      // Schedule reminder 1 hour before
      const reminderTime = new Date(appointmentDateTime.getTime() - 60 * 60 * 1000);
      const timeUntilReminder = reminderTime.getTime() - now.getTime();
      
      if (timeUntilReminder > 0) {
        this.scheduleNotification({
          title: 'Appointment Reminder',
          body: `${appointment.title} in 1 hour`,
          type: 'reminder',
          url: '/appointments',
          id: `reminder-${appointment.id}`
        }, timeUntilReminder);
      }
    });
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// Global function to add notifications to context
export let addNotificationToContext: ((notification: Omit<NotificationData, 'timestamp'>) => void) | null = null;

export function setNotificationContextHandler(handler: (notification: Omit<NotificationData, 'timestamp'>) => void) {
  addNotificationToContext = handler;
}