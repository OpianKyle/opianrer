import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, BellOff, Check, X } from 'lucide-react';
import { useNotificationContext } from '@/contexts/notification-context';
import { isPushNotificationSupported } from '@/lib/push-notifications';

export default function PushNotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const { requestPushPermission } = useNotificationContext();

  useEffect(() => {
    // Check if we should show the prompt
    const checkNotificationStatus = () => {
      if (!isPushNotificationSupported()) {
        return;
      }

      const hasBeenPrompted = localStorage.getItem('push-notifications-prompted');
      const permission = Notification.permission;

      if (permission === 'granted') {
        setIsEnabled(true);
      } else if (permission === 'default' && !hasBeenPrompted) {
        // Show prompt after a short delay
        setTimeout(() => {
          setShowPrompt(true);
        }, 2000);
      }
    };

    checkNotificationStatus();
  }, []);

  const handleEnableNotifications = async () => {
    const granted = await requestPushPermission();
    setIsEnabled(granted);
    setShowPrompt(false);
    localStorage.setItem('push-notifications-prompted', 'true');
    localStorage.setItem('push-notifications-enabled', granted.toString());
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('push-notifications-prompted', 'true');
  };

  if (!showPrompt && !isEnabled) {
    return null;
  }

  if (isEnabled) {
    return (
      <Alert className="mb-4 bg-green-50 border-green-200">
        <Check className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Push notifications are enabled! You'll receive notifications for appointments and important updates.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="mb-4 border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <Bell className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg text-blue-900">Enable Push Notifications</CardTitle>
        </div>
        <CardDescription className="text-blue-700">
          Stay updated with real-time notifications for appointment assignments, updates, and important reminders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-2">
          <Button 
            onClick={handleEnableNotifications}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Bell className="h-4 w-4 mr-2" />
            Enable Notifications
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDismiss}
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
          >
            <X className="h-4 w-4 mr-2" />
            Not Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}