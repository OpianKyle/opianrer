import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { InterestRate, InsertInterestRate, insertInterestRateSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, User, Bell, Shield, Palette, Plus, Trash2, Loader2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import NotificationSettings from "@/components/notification-settings";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");

  const { data: rates, isLoading: ratesLoading } = useQuery<InterestRate[]>({ 
    queryKey: ["/api/interest-rates"] 
  });

  const rateForm = useForm<InsertInterestRate>({
    resolver: zodResolver(insertInterestRateSchema),
    defaultValues: {
      term: 1,
      rate: "",
      isDefault: false
    }
  });

  const createRateMutation = useMutation({
    mutationFn: async (data: InsertInterestRate) => {
      const res = await apiRequest("POST", "/api/interest-rates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interest-rates"] });
      rateForm.reset();
      toast({ title: "Rate added successfully" });
    }
  });

  const deleteRateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/interest-rates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interest-rates"] });
      toast({ title: "Rate deleted" });
    }
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl relative min-h-screen overflow-x-hidden">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account settings and interest rates</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="rates">Rates</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Interest Rates</CardTitle>
              <CardDescription>Configure standard interest rates for different terms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {user?.role === 'super_admin' ? (
                <Form {...rateForm}>
                  <form onSubmit={rateForm.handleSubmit((data) => createRateMutation.mutate(data))} className="grid grid-cols-3 gap-4 items-end">
                    <FormField
                      control={rateForm.control}
                      name="term"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Term (Years)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={rateForm.control}
                      name="rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rate (%)</FormLabel>
                          <FormControl>
                            <Input placeholder="9.75" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={createRateMutation.isPending}>
                      <Plus className="h-4 w-4 mr-2" /> Add
                    </Button>
                  </form>
                </Form>
              ) : (
                <p className="text-sm text-muted-foreground">Only super admins can manage interest rates.</p>
              )}

              <div className="border rounded-md divide-y">
                {ratesLoading ? (
                  <div className="p-4 flex justify-center"><Loader2 className="animate-spin h-4 w-4" /></div>
                ) : rates?.map((rate) => (
                  <div key={rate.id} className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-bold">{rate.term} Year</span>
                      <span className="ml-4 text-primary font-mono">{rate.rate}%</span>
                    </div>
                    {user?.role === 'super_admin' && (
                      <Button variant="ghost" size="icon" onClick={() => deleteRateMutation.mutate(rate.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
    username: user?.username || "",
    email: user?.email || "",
    firstName: "",
    lastName: "",
    phone: "",
    company: "",
    timezone: "UTC"
  });

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    desktopNotifications: true,
    darkMode: false,
    language: "en",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h"
  });

  const handleProfileSave = () => {
    toast({
      title: "Profile Updated",
      description: "Your profile information has been saved successfully.",
    });
  };

  const handlePreferenceChange = (key: string, value: boolean | string) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl relative min-h-screen overflow-x-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-50/30 -z-10"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-primary/20 to-blue-600/20 rounded-full blur-3xl animate-pulse -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <User className="w-4 h-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>Security</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center space-x-2">
            <Palette className="w-4 h-4" />
            <span>Appearance</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                    placeholder="Enter your first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                    placeholder="Enter your last name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={profileData.username}
                  onChange={(e) => setProfileData({...profileData, username: e.target.value})}
                  placeholder="Enter your username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                  placeholder="Enter your email"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                    placeholder="Enter your phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={profileData.company}
                    onChange={(e) => setProfileData({...profileData, company: e.target.value})}
                    placeholder="Enter your company"
                  />
                </div>
              </div>
              
              <div className="pt-4">
                <Button onClick={handleProfileSave} className="bg-primary hover:bg-primary/90">
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security and authentication preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Change Password</h3>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        placeholder="Enter current password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Confirm new password"
                      />
                    </div>
                    <Button variant="outline" size="sm">
                      Update Password
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="font-medium mb-2">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Add an extra layer of security to your account
                  </p>
                  <Button variant="outline" size="sm">
                    Enable 2FA
                  </Button>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="font-medium mb-2">Session Management</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Manage your active sessions and sign out from all devices
                  </p>
                  <Button variant="outline" size="sm">
                    View Active Sessions
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize how Opian Core looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="darkMode">Dark Mode</Label>
                    <p className="text-sm text-gray-600">Toggle between light and dark themes</p>
                  </div>
                  <Switch
                    id="darkMode"
                    checked={preferences.darkMode}
                    onCheckedChange={(checked) => handlePreferenceChange('darkMode', checked)}
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="language">Language</Label>
                    <select 
                      id="language"
                      value={preferences.language}
                      onChange={(e) => handlePreferenceChange('language', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <select 
                      id="dateFormat"
                      value={preferences.dateFormat}
                      onChange={(e) => handlePreferenceChange('dateFormat', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="timeFormat">Time Format</Label>
                    <select 
                      id="timeFormat"
                      value={preferences.timeFormat}
                      onChange={(e) => handlePreferenceChange('timeFormat', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      <option value="12h">12 Hour</option>
                      <option value="24h">24 Hour</option>
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}