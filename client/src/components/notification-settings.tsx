import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Check, X } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { useNotificationContext } from '@/contexts/notification-context';
import { useToast } from '@/hooks/use-toast';

export default function NotificationSettings() {
  const { 
    isSupported, 
    permission, 
    isInitialized, 
    requestPermission,
    showNotification 
  } = useNotifications();
  const { addNotification } = useNotificationContext();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState({
    appointmentReminders: true,
    newAppointments: true,
    clientUpdates: true,
    systemNotifications: true
  });

  const handlePermissionRequest = async () => {
    const newPermission = await requestPermission();
    if (newPermission === 'granted') {
      toast({
        title: "Notifications Enabled",
        description: "You will now receive push notifications for important updates.",
      });
    } else {
      toast({
        title: "Permission Denied",
        description: "Please enable notifications in your browser settings to receive alerts.",
        variant: "destructive"
      });
    }
  };

  const handleTestNotification = () => {
    showNotification({
      title: 'Test Notification',
      body: 'This is a test notification from Opian Core!',
      type: 'system'
    });
    toast({
      title: "Test Sent",
      description: "Check if you received the notification.",
    });
  };

  const handleSettingChange = (setting: keyof typeof settings, value: boolean) => {
    setSettings(prev => ({ ...prev, [setting]: value }));
    // Here you would typically save to backend/localStorage
  };

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><Check className="w-3 h-3 mr-1" />Enabled</Badge>;
      case 'denied':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Blocked</Badge>;
      default:
        return <Badge variant="outline">Not Set</Badge>;
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BellOff className="w-5 h-5" />
            <span>Notifications Not Supported</span>
          </CardTitle>
          <CardDescription>
            Your browser doesn't support push notifications.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="w-5 h-5" />
            <span>Push Notifications</span>
          </CardTitle>
          <CardDescription>
            Manage your notification preferences for Opian Core
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Permission Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium">Permission Status</h3>
              <p className="text-sm text-gray-600">
                {permission === 'granted' 
                  ? 'Notifications are enabled for this site'
                  : permission === 'denied' 
                  ? 'Notifications are blocked for this site'
                  : 'Permission not yet granted'
                }
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {getPermissionBadge()}
              {permission !== 'granted' && (
                <Button onClick={handlePermissionRequest} size="sm">
                  Enable Notifications
                </Button>
              )}
            </div>
          </div>

          {/* Test Notification */}
          {permission === 'granted' && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Test Notifications</h3>
                <p className="text-sm text-gray-600">
                  Send a test notification to verify everything is working
                </p>
              </div>
              <Button onClick={handleTestNotification} variant="outline" size="sm">
                Send Test
              </Button>
            </div>
          )}

          {/* Notification Settings */}
          {permission === 'granted' && (
            <div className="space-y-4">
              <h3 className="font-medium">Notification Types</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="appointment-reminders">Appointment Reminders</Label>
                    <p className="text-sm text-gray-600">Get notified 1 hour before appointments</p>
                  </div>
                  <Switch
                    id="appointment-reminders"
                    checked={settings.appointmentReminders}
                    onCheckedChange={(checked) => handleSettingChange('appointmentReminders', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="new-appointments">New Appointments</Label>
                    <p className="text-sm text-gray-600">Get notified when new appointments are scheduled</p>
                  </div>
                  <Switch
                    id="new-appointments"
                    checked={settings.newAppointments}
                    onCheckedChange={(checked) => handleSettingChange('newAppointments', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="client-updates">Client Updates</Label>
                    <p className="text-sm text-gray-600">Get notified about client-related changes</p>
                  </div>
                  <Switch
                    id="client-updates"
                    checked={settings.clientUpdates}
                    onCheckedChange={(checked) => handleSettingChange('clientUpdates', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="system-notifications">System Notifications</Label>
                    <p className="text-sm text-gray-600">Get notified about system updates and important news</p>
                  </div>
                  <Switch
                    id="system-notifications"
                    checked={settings.systemNotifications}
                    onCheckedChange={(checked) => handleSettingChange('systemNotifications', checked)}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}