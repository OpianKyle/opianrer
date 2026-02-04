// Push Notification Service
let pushNotificationsEnabled = false;

export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
}

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (!('serviceWorker' in navigator)) {
    console.log('This browser does not support service workers');
    return false;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration);

    // Request notification permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Notification permission granted');
      pushNotificationsEnabled = true;
      return true;
    } else {
      console.log('Notification permission denied');
      return false;
    }
  } catch (error) {
    console.error('Error setting up push notifications:', error);
    return false;
  }
};

export const showPushNotification = async (data: PushNotificationData): Promise<void> => {
  if (!pushNotificationsEnabled || Notification.permission !== 'granted') {
    console.log('Push notifications not enabled or permission not granted');
    return;
  }

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      // Show notification via service worker
      await registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/logo.png',
        badge: '/logo.png',
        vibrate: [200, 100, 200],
        requireInteraction: data.requireInteraction || false,
        tag: data.tag || 'opian-notification',
        data: {
          url: data.url || '/',
          timestamp: Date.now()
        },
        actions: [
          {
            action: 'view',
            title: 'View',
            icon: '/logo.png'
          },
          {
            action: 'close',
            title: 'Close'
          }
        ]
      });
      
      console.log('Push notification sent:', data.title);
    } else {
      // Fallback to browser notification
      const notification = new Notification(data.title, {
        body: data.body,
        icon: data.icon || '/logo.png',
        tag: data.tag || 'opian-notification'
      });

      notification.onclick = () => {
        if (data.url) {
          window.focus();
          window.location.href = data.url;
        }
        notification.close();
      };
    }
  } catch (error) {
    console.error('Error showing push notification:', error);
  }
};

export const isPushNotificationSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

export const isPushNotificationEnabled = (): boolean => {
  return pushNotificationsEnabled && Notification.permission === 'granted';
};

// Auto-request permission on first load if supported
if (isPushNotificationSupported() && Notification.permission === 'default') {
  // Request permission after a short delay to avoid interrupting the user immediately
  setTimeout(() => {
    requestNotificationPermission();
  }, 3000);
}