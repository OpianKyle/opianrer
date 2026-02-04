import { NotificationItem } from '@/hooks/use-notification-count';

// Global notification function using window object
export function triggerNotification(notification: Omit<NotificationItem, 'id' | 'read' | 'timestamp'>) {
  if ((window as any).addNotification) {
    (window as any).addNotification(notification);
  }
}

// Event-based notification triggers
export const NotificationTriggers = {
  // Client-related notifications
  clientCreated: (clientName: string) => {
    triggerNotification({
      title: 'New Client Added',
      body: `${clientName} has been successfully added to your client list`,
      type: 'team',
      url: '/clients'
    });
  },

  clientUpdated: (clientName: string) => {
    triggerNotification({
      title: 'Client Updated',
      body: `${clientName}'s information has been updated`,
      type: 'system',
      url: '/clients'
    });
  },

  clientDeleted: (clientName: string) => {
    triggerNotification({
      title: 'Client Removed',
      body: `${clientName} has been removed from your client list`,
      type: 'system',
      url: '/clients'
    });
  },

  // Appointment-related notifications
  appointmentCreated: (clientName: string, date: string, time: string) => {
    triggerNotification({
      title: 'Appointment Scheduled',
      body: `Meeting with ${clientName} scheduled for ${date} at ${time}`,
      type: 'appointment',
      url: '/appointments'
    });
  },

  appointmentUpdated: (clientName: string, date: string, time: string) => {
    triggerNotification({
      title: 'Appointment Updated',
      body: `Meeting with ${clientName} rescheduled to ${date} at ${time}`,
      type: 'appointment',
      url: '/appointments'
    });
  },

  appointmentCancelled: (clientName: string) => {
    triggerNotification({
      title: 'Appointment Cancelled',
      body: `Meeting with ${clientName} has been cancelled`,
      type: 'system',
      url: '/appointments'
    });
  },

  appointmentReminder: (clientName: string, time: string) => {
    triggerNotification({
      title: 'Upcoming Meeting',
      body: `You have a meeting with ${clientName} in 30 minutes (${time})`,
      type: 'reminder',
      url: '/appointments'
    });
  },

  // Document-related notifications
  documentUploaded: (clientName: string, fileName: string) => {
    triggerNotification({
      title: 'Document Uploaded',
      body: `${fileName} has been uploaded for ${clientName}`,
      type: 'system',
      url: '/documents'
    });
  },

  documentDeleted: (fileName: string) => {
    triggerNotification({
      title: 'Document Removed',
      body: `${fileName} has been deleted`,
      type: 'system',
      url: '/documents'
    });
  },

  // Team-related notifications
  teamMemberAdded: (memberName: string, role: string) => {
    triggerNotification({
      title: 'New Team Member',
      body: `${memberName} has joined your team as ${role}`,
      type: 'team',
      url: '/team-members'
    });
  },

  teamMemberRemoved: (memberName: string) => {
    triggerNotification({
      title: 'Team Member Removed',
      body: `${memberName} has been removed from your team`,
      type: 'team',
      url: '/team-members'
    });
  },

  // System notifications
  systemUpdate: (message: string) => {
    triggerNotification({
      title: 'System Update',
      body: message,
      type: 'system',
      url: '/dashboard'
    });
  },

  errorOccurred: (error: string) => {
    triggerNotification({
      title: 'Error Occurred',
      body: error,
      type: 'system',
      url: '/dashboard'
    });
  },

  // Achievement notifications
  milestoneReached: (milestone: string, count: number) => {
    triggerNotification({
      title: 'Milestone Achieved!',
      body: `Congratulations! You've reached ${count} ${milestone}`,
      type: 'system',
      url: '/dashboard'
    });
  }
};