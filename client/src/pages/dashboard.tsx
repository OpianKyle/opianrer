import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { statsApi, clientsApi, appointmentsApi } from "@/lib/api";
import { 
  Users, 
  TrendingUp, 
  Calendar, 
  DollarSign,
  Plus,
  CalendarPlus,
  Upload,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Clock,
  Building,
  Phone,
  Mail,
  MapPin,
  Wifi,
  WifiOff
} from "lucide-react";
import { format, isToday, isTomorrow, isThisWeek, startOfWeek, endOfWeek } from "date-fns";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePresence } from "@/hooks/use-presence";
import { useTheme } from "@/contexts/theme-context";
import PushNotificationPrompt from "@/components/push-notification-prompt";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { users: presenceUsers } = usePresence();
  const { theme, themes } = useTheme();
  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats"],
    queryFn: statsApi.get,
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: clientsApi.getAll,
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: appointmentsApi.getAll,
  });

  const recentClients = Array.isArray(clients) ? clients.slice(0, 5) : [];
  const todayAppointments = Array.isArray(appointments) ? appointments.filter(apt => {
    const aptDate = new Date(apt.date);
    return isToday(aptDate);
  }) : [];
  
  const tomorrowAppointments = Array.isArray(appointments) ? appointments.filter(apt => {
    const aptDate = new Date(apt.date);
    return isTomorrow(aptDate);
  }) : [];
  
  const weekAppointments = Array.isArray(appointments) ? appointments.filter(apt => {
    const aptDate = new Date(apt.date);
    return isThisWeek(aptDate, { weekStartsOn: 0 });
  }) : [];

  // Calculate trends and insights
  const activeClients = Array.isArray(clients) ? clients.filter(c => c.status === 'active') : [];
  const prospectClients = Array.isArray(clients) ? clients.filter(c => c.status === 'prospect') : [];
  const totalRevenue = clients.reduce((sum, client) => sum + (client.value || 0), 0);

  // Theme-aware styles
  const currentTheme = themes[theme];
  const themeStyles = {
    background: currentTheme.colors.background,
    surface: currentTheme.colors.surface,
    text: currentTheme.colors.text,
    primary: currentTheme.colors.primary,
    gradient: currentTheme.colors.gradient,
  };
  const avgDealSize = totalRevenue / clients.length || 0;

  const getClientName = (clientId: number | null) => {
    if (!clientId) return "No client";
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.firstName} ${client.surname}` : "Client not found";
  };

  if (statsLoading || clientsLoading || appointmentsLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 ml-0 lg:ml-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "from-blue-500 to-blue-600",
      change: "+24.5%",
      changeType: "positive" as const,
      subtitle: `Avg: $${Math.round(avgDealSize).toLocaleString()} per client`,
    },
    {
      title: "Active Clients",
      value: activeClients.length,
      icon: Users,
      color: "from-green-500 to-green-600",
      change: `+${prospectClients.length} prospects`,
      changeType: "positive" as const,
      subtitle: `${Math.round((activeClients.length / clients.length) * 100)}% conversion rate`,
    },
    {
      title: "This Week",
      value: weekAppointments.length,
      icon: Calendar,
      color: "from-purple-500 to-purple-600",
      change: `${todayAppointments.length} today`,
      changeType: "neutral" as const,
      subtitle: `${tomorrowAppointments.length} tomorrow`,
    },
    {
      title: "Growth Rate",
      value: "+18.2%",
      icon: TrendingUp,
      color: "from-orange-500 to-orange-600",
      change: "vs last month",
      changeType: "positive" as const,
      subtitle: "Above industry avg",
    },
  ];

  return (
    <div 
      className="p-2 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 lg:space-y-6 h-full relative overflow-hidden transition-all duration-300"
      style={{ 
        backgroundColor: themes[theme].colors.background,
        color: themes[theme].colors.text 
      }}
    >
      {/* Background decoration */}
      <div 
        className="absolute inset-0 -z-10 opacity-20"
        style={{
          background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}10, transparent, ${themes[theme].colors.secondary}20)`
        }}
      ></div>
      <div 
        className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl animate-pulse -z-10 transform translate-x-1/2 -translate-y-1/2"
        style={{
          background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}30, ${themes[theme].colors.secondary}20)`
        }}
      ></div>
      <div 
        className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl animate-pulse -z-10 transform -translate-x-1/2 translate-y-1/2"
        style={{
          background: `linear-gradient(to bottom right, ${themes[theme].colors.secondary}20, ${themes[theme].colors.primary}30)`
        }}
      ></div>
      
      {/* Push Notification Prompt */}
      <PushNotificationPrompt />
      
      {/* Welcome Section */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <div 
          className="relative backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl border overflow-hidden transition-all duration-300"
          style={{
            backgroundColor: themes[theme].colors.glassBg,
            borderColor: themes[theme].colors.border,
          }}
        >
          {/* Background decoration */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}20, ${themes[theme].colors.surface}50, transparent)`
            }}
          ></div>
          <div 
            className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-2xl animate-pulse"
            style={{
              background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}30, ${themes[theme].colors.secondary}20)`
            }}
          ></div>
          <div 
            className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full blur-2xl animate-pulse"
            style={{
              background: `linear-gradient(to bottom right, ${themes[theme].colors.secondary}20, ${themes[theme].colors.primary}30)`
            }}
          ></div>
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-3 sm:mb-4">
              <h1 
                className="text-xl sm:text-2xl lg:text-4xl font-bold transition-colors duration-300"
                style={{ color: themes[theme].colors.text }}
              >
                Good morning, {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username || 'User'}!
              </h1>
              {user?.role === 'super_admin' && (
                <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg px-3 py-1 text-sm font-semibold">
                  Super Admin
                </Badge>
              )}
              {user?.role === 'admin' && (
                <Badge className="bg-blue-600 text-white">
                  Admin
                </Badge>
              )}
            </div>
            <p 
              className="text-sm sm:text-base lg:text-xl mt-2 font-medium transition-colors duration-300"
              style={{ color: themes[theme].colors.textSecondary }}
            >
              Here's what's happening with your business today.
            </p>
            
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mt-4 sm:mt-6">
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50/80 backdrop-blur-sm px-3 py-1.5">
                <Activity className="w-4 h-4 mr-2" />
                All systems operational
              </Badge>
              <div className="flex items-center space-x-2 text-sm text-slate-500">
                <Clock className="w-4 h-4" />
                <span>Last updated: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Cards with Stained Glass Effect */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index} 
              className="relative overflow-hidden border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 group transform hover:scale-105 hover:-translate-y-2"
            >
              {/* Theme-aware stained glass base */}
              <div 
                className="absolute inset-0" 
                style={{
                  background: `linear-gradient(to bottom right, ${themes[theme].colors.surface}F8, ${themes[theme].colors.surface}F0, ${themes[theme].colors.surface}F8)`
                }}
              />
              
              {/* Theme-aware stained glass segments */}
              <div className="absolute inset-0">
                <div 
                  className="absolute top-0 left-0 w-1/2 h-1/3"
                  style={{
                    background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}40, ${themes[theme].colors.primary}25, transparent)`
                  }}
                />
                <div 
                  className="absolute top-0 right-0 w-1/2 h-2/5"
                  style={{
                    background: `linear-gradient(to bottom left, ${themes[theme].colors.secondary}35, ${themes[theme].colors.secondary}20, transparent)`
                  }}
                />
                <div 
                  className="absolute bottom-0 left-0 w-2/3 h-1/2"
                  style={{
                    background: `linear-gradient(to top right, ${themes[theme].colors.accent}30, ${themes[theme].colors.accent}18, transparent)`
                  }}
                />
                <div 
                  className="absolute bottom-0 right-0 w-1/2 h-1/3"
                  style={{
                    background: `linear-gradient(to top left, ${themes[theme].colors.primary}35, ${themes[theme].colors.primary}20, transparent)`
                  }}
                />
                <div 
                  className="absolute top-1/3 left-1/4 w-1/2 h-1/3"
                  style={{
                    background: `linear-gradient(to bottom right, ${themes[theme].colors.secondary}25, ${themes[theme].colors.secondary}15, transparent)`
                  }}
                />
                <div 
                  className="absolute top-1/2 right-1/4 w-1/3 h-1/4"
                  style={{
                    background: `linear-gradient(to bottom left, ${themes[theme].colors.text}30, ${themes[theme].colors.text}18, transparent)`
                  }}
                />
              </div>
              
              {/* Lead lines effect */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-1/3 left-0 w-full h-px bg-slate-500/50" />
                <div className="absolute top-2/3 left-0 w-full h-px bg-slate-500/50" />
                <div className="absolute top-0 left-1/3 h-full w-px bg-slate-500/50" />
                <div className="absolute top-0 left-2/3 h-full w-px bg-slate-500/50" />
              </div>
              
              {/* Glass reflection */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Subtle border */}
              <div className="absolute inset-0 rounded-lg border border-slate-400/30 shadow-inner"></div>
              <CardContent className="p-3 sm:p-4 lg:p-6 relative z-10 backdrop-blur-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <p 
                        className="text-sm font-semibold drop-shadow-sm"
                        style={{ color: themes[theme].colors.text }}
                      >
                        {stat.title}
                      </p>
                      {stat.changeType === 'positive' && (
                        <ArrowUpRight 
                          className="w-3 h-3 drop-shadow-sm" 
                          style={{ color: themes[theme].colors.secondary }}
                        />
                      )}
                    </div>
                    <p 
                      className="text-2xl font-bold mb-1 drop-shadow-sm"
                      style={{ color: themes[theme].colors.text }}
                    >
                      {stat.value}
                    </p>
                    <p 
                      className="text-xs mb-2 drop-shadow-sm"
                      style={{ color: themes[theme].colors.textSecondary }}
                    >
                      {stat.subtitle}
                    </p>
                    <div className="flex items-center space-x-1">
                      <span 
                        className="text-sm font-semibold drop-shadow-sm"
                        style={{ 
                          color: stat.changeType === 'positive' 
                            ? themes[theme].colors.secondary 
                            : themes[theme].colors.textSecondary 
                        }}
                      >
                        {stat.change}
                      </span>
                    </div>
                  </div>
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-all duration-300 backdrop-blur-sm border border-white/50 relative"
                    style={{
                      background: themes[theme].colors.gradient
                    }}
                  >
                    <Icon className="w-6 h-6 text-white drop-shadow-md" />
                    <div className="absolute inset-0 bg-white/25 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {/* Recent Client Activity - Light Blue Stained Glass */}
        <div className="lg:col-span-2">
          <Card className="relative overflow-hidden border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 group">
            {/* Theme-aware stained glass base */}
            <div 
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom right, ${themes[theme].colors.surface}F8, ${themes[theme].colors.surface}F0, ${themes[theme].colors.surface}F8)`
              }}
            />
            
            {/* Theme-aware stained glass segments */}
            <div className="absolute inset-0">
              <div 
                className="absolute top-0 left-0 w-1/2 h-1/3"
                style={{
                  background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}40, ${themes[theme].colors.primary}25, transparent)`
                }}
              />
              <div 
                className="absolute top-0 right-0 w-1/2 h-2/5"
                style={{
                  background: `linear-gradient(to bottom left, ${themes[theme].colors.secondary}35, ${themes[theme].colors.secondary}20, transparent)`
                }}
              />
              <div 
                className="absolute bottom-0 left-0 w-2/3 h-1/2"
                style={{
                  background: `linear-gradient(to top right, ${themes[theme].colors.accent}30, ${themes[theme].colors.accent}18, transparent)`
                }}
              />
              <div 
                className="absolute bottom-0 right-0 w-1/2 h-1/3"
                style={{
                  background: `linear-gradient(to top left, ${themes[theme].colors.primary}35, ${themes[theme].colors.primary}20, transparent)`
                }}
              />
              <div 
                className="absolute top-1/3 left-1/4 w-1/2 h-1/3"
                style={{
                  background: `linear-gradient(to bottom right, ${themes[theme].colors.secondary}25, ${themes[theme].colors.secondary}15, transparent)`
                }}
              />
              <div 
                className="absolute top-1/2 right-1/4 w-1/3 h-1/4"
                style={{
                  background: `linear-gradient(to bottom left, ${themes[theme].colors.text}30, ${themes[theme].colors.text}18, transparent)`
                }}
              />
            </div>
            
            {/* Lead lines effect */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-1/3 left-0 w-full h-px bg-slate-500/50" />
              <div className="absolute top-2/3 left-0 w-full h-px bg-slate-500/50" />
              <div className="absolute top-0 left-1/3 h-full w-px bg-slate-500/50" />
              <div className="absolute top-0 left-2/3 h-full w-px bg-slate-500/50" />
            </div>
            
            {/* Glass reflection */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            {/* Subtle border */}
            <div className="absolute inset-0 rounded-lg border border-slate-400/30 shadow-inner"></div>
            <CardHeader className="pb-3 relative z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-slate-700 drop-shadow-sm">Client Activity</CardTitle>
                <Button 
                  onClick={() => setLocation("/clients")}
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-500 hover:text-gray-700"
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 p-4">
              <div className="space-y-3">
                {recentClients.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
                    <p className="text-gray-500">Add your first client to get started</p>
                  </div>
                ) : (
                  recentClients.map((client) => (
                    <div key={client.id} className="group relative">
                      <div className="flex items-center space-x-3 p-3 rounded-xl border-2 border-white/80 bg-white/95 hover:border-blue-400 hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105 backdrop-blur-md shadow-lg">
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {(client.firstName?.[0] || '') + (client.surname?.[0] || '')}
                            </span>
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                            client.status === 'active' ? 'bg-green-500' : 
                            client.status === 'prospect' ? 'bg-yellow-500' : 'bg-gray-400'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{client.firstName} {client.surname}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Building className="w-3 h-3 text-gray-400" />
                                <p className="text-xs text-gray-600">{client.employer || client.occupation || 'N/A'}</p>
                                <Badge className={`text-xs ${
                                  client.status === 'active' ? 'bg-green-100 text-green-700' :
                                  client.status === 'prospect' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {client.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">
                                ${client.value?.toLocaleString() || 0}
                              </p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(client.lastContact || client.createdAt || new Date()), 'MMM d')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 mt-2">
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                              <Mail className="w-3 h-3" />
                              <span>{client.email}</span>
                            </div>
                            {client.cellPhone && (
                              <div className="flex items-center space-x-1 text-xs text-gray-500">
                                <Phone className="w-3 h-3" />
                                <span>{client.cellPhone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
          {/* Quick Actions - Theme-aware Stained Glass */}
          <Card className="relative overflow-hidden border-0 shadow-2xl hover:shadow-3xl transition-all duration-500 group">
            {/* Theme-aware stained glass base */}
            <div 
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom right, ${themes[theme].colors.surface}F8, ${themes[theme].colors.surface}F0, ${themes[theme].colors.surface}F8)`
              }}
            />
            
            {/* Theme-aware stained glass segments */}
            <div className="absolute inset-0">
              <div 
                className="absolute top-0 left-0 w-full h-1/3"
                style={{
                  background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}35, ${themes[theme].colors.primary}20, transparent)`
                }}
              />
              <div 
                className="absolute top-1/3 left-0 w-2/3 h-1/3"
                style={{
                  background: `linear-gradient(to bottom left, ${themes[theme].colors.secondary}30, ${themes[theme].colors.secondary}18, transparent)`
                }}
              />
              <div 
                className="absolute bottom-0 left-0 w-full h-1/3"
                style={{
                  background: `linear-gradient(to top right, ${themes[theme].colors.accent}25, ${themes[theme].colors.accent}15, transparent)`
                }}
              />
              <div 
                className="absolute top-1/4 right-0 w-1/2 h-1/2"
                style={{
                  background: `linear-gradient(to top left, ${themes[theme].colors.primary}30, ${themes[theme].colors.primary}18, transparent)`
                }}
              />
            </div>
            
            {/* Lead lines pattern */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-1/3 left-0 w-full h-px bg-slate-500/50" />
              <div className="absolute top-2/3 left-0 w-full h-px bg-slate-500/50" />
              <div className="absolute top-0 left-1/2 h-full w-px bg-slate-500/50" />
            </div>
            
            {/* Glass reflection */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            {/* Subtle border */}
            <div className="absolute inset-0 rounded-lg border border-slate-400/30 shadow-inner"></div>
            <CardHeader className="pb-4 relative z-10">
              <CardTitle 
                className="text-lg font-semibold drop-shadow-sm transition-colors duration-300"
                style={{ color: themes[theme].colors.text }}
              >
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 relative z-10 p-3 sm:p-4 lg:p-6">
              <Button 
                onClick={() => setLocation("/clients")}
                className="w-full h-10 sm:h-12 text-sm sm:text-base text-white shadow-md transition-all duration-200 hover:shadow-lg"
                style={{
                  background: themes[theme].colors.gradient,
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Client
              </Button>
              <Button 
                onClick={() => setLocation("/booking")}
                className="w-full h-10 sm:h-12 text-sm sm:text-base text-white shadow-md transition-all duration-200 hover:shadow-lg"
                style={{
                  background: `linear-gradient(to right, ${themes[theme].colors.primary}DD, ${themes[theme].colors.secondary}DD)`,
                }}
              >
                <CalendarPlus className="w-4 h-4 mr-2" />
                Book Appointment
              </Button>
              <Button 
                onClick={() => setLocation("/documents")}
                className="w-full h-10 sm:h-12 text-sm sm:text-base text-white shadow-md transition-all duration-200 hover:shadow-lg"
                style={{
                  background: `linear-gradient(to right, ${themes[theme].colors.secondary}DD, ${themes[theme].colors.accent}DD)`,
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Documents
              </Button>
            </CardContent>
          </Card>

          {/* Today's Schedule - Theme-aware Stained Glass */}
          <Card className="relative overflow-hidden border-0 shadow-2xl backdrop-blur-sm">
            {/* Theme-aware stained glass base */}
            <div 
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom right, ${themes[theme].colors.surface}F8, ${themes[theme].colors.surface}F0, ${themes[theme].colors.surface}F8)`
              }}
            />
            
            {/* Theme-aware stained glass segments */}
            <div className="absolute inset-0">
              <div 
                className="absolute top-0 left-0 w-2/3 h-1/2"
                style={{
                  background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}35, ${themes[theme].colors.primary}20, transparent)`
                }}
              />
              <div 
                className="absolute top-0 right-0 w-1/2 h-2/3"
                style={{
                  background: `linear-gradient(to bottom left, ${themes[theme].colors.secondary}30, ${themes[theme].colors.secondary}18, transparent)`
                }}
              />
              <div 
                className="absolute bottom-0 left-0 w-1/2 h-1/2"
                style={{
                  background: `linear-gradient(to top right, ${themes[theme].colors.accent}25, ${themes[theme].colors.accent}15, transparent)`
                }}
              />
              <div 
                className="absolute bottom-0 right-0 w-2/3 h-1/3"
                style={{
                  background: `linear-gradient(to top left, ${themes[theme].colors.primary}30, ${themes[theme].colors.primary}18, transparent)`
                }}
              />
            </div>
            
            {/* Lead lines pattern */}
            <div className="absolute inset-0 opacity-15">
              <div className="absolute top-1/2 left-0 w-full h-px bg-slate-600/60" />
              <div className="absolute top-0 left-1/3 h-full w-px bg-slate-600/60" />
              <div className="absolute top-0 left-2/3 h-full w-px bg-slate-600/60" />
            </div>
            
            <div className="absolute inset-0 rounded-lg border border-slate-400/30 shadow-inner"></div>
            <CardHeader className="pb-4 relative z-10">
              <div className="flex items-center justify-between">
                <CardTitle 
                  className="text-lg font-semibold drop-shadow-sm transition-colors duration-300"
                  style={{ color: themes[theme].colors.text }}
                >
                  Today's Schedule
                </CardTitle>
                <Badge 
                  variant="secondary" 
                  className="transition-colors duration-300"
                  style={{ 
                    backgroundColor: `${themes[theme].colors.primary}20`,
                    color: themes[theme].colors.primary 
                  }}
                >
                  {todayAppointments.length} meetings
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="space-y-3">
                {todayAppointments.length === 0 ? (
                  <div className="text-center py-6">
                    <Calendar className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">No meetings today</p>
                    <p className="text-xs text-gray-400 mt-1">Enjoy your free time!</p>
                  </div>
                ) : (
                  todayAppointments.map((appointment) => (
                    <div key={appointment.id} className="relative">
                      <div className="flex items-start space-x-3 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 hover:shadow-md transition-all duration-200">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex flex-col items-center justify-center text-white shadow-md">
                            <span className="text-xs font-bold">{appointment.startTime.split(':')[0]}</span>
                            <span className="text-xs">{appointment.startTime.split(':')[1]}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{appointment.title}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {getClientName(appointment.clientId)}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge className={`text-xs ${
                              appointment.type === 'meeting' ? 'bg-blue-100 text-blue-700' :
                              appointment.type === 'call' ? 'bg-green-100 text-green-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {appointment.type}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {appointment.startTime} - {appointment.endTime}
                            </span>
                          </div>
                          {appointment.location && (
                            <div className="flex items-center space-x-1 mt-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500 truncate">{appointment.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>


        </div>
      </div>
    </div>
  );
}
