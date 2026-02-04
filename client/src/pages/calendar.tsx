import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { appointmentsApi, clientsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  User
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek, addDays, subDays, addWeeks, subWeeks, startOfDay, endOfDay, eachHourOfInterval, addHours } from "date-fns";
import AddAppointmentModal from "@/components/modals/add-appointment-modal";
import { AppointmentDetailsModal } from "@/components/modals/appointment-details-modal";
import { useTheme } from "@/contexts/theme-context";
import { type Appointment } from "@shared/schema";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const { theme, themes } = useTheme();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: appointmentsApi.getAll,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: clientsApi.getAll,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => fetch("/api/users").then(res => res.json()),
  });

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      if (direction === 'prev') {
        newDate.setMonth(currentDate.getMonth() - 1);
      } else {
        newDate.setMonth(currentDate.getMonth() + 1);
      }
    } else if (viewMode === 'week') {
      if (direction === 'prev') {
        newDate.setDate(currentDate.getDate() - 7);
      } else {
        newDate.setDate(currentDate.getDate() + 7);
      }
    } else if (viewMode === 'day') {
      if (direction === 'prev') {
        newDate.setDate(currentDate.getDate() - 1);
      } else {
        newDate.setDate(currentDate.getDate() + 1);
      }
    }
    setCurrentDate(newDate);
  };

  const getDaysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  };

  const getDaysInWeek = () => {
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getHoursInDay = () => {
    const start = startOfDay(currentDate);
    const end = endOfDay(currentDate);
    return eachHourOfInterval({ start, end });
  };

  const getViewTitle = () => {
    switch (viewMode) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'day':
        return format(currentDate, 'MMMM d, yyyy');
      default:
        return format(currentDate, 'MMMM yyyy');
    }
  };

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.date);
      return aptDate.toDateString() === date.toDateString();
    });
  };

  const getAppointmentsForHour = (date: Date, hour: number) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.date);
      const aptHour = parseInt(apt.startTime.split(':')[0]);
      return aptDate.toDateString() === date.toDateString() && aptHour === hour;
    });
  };

  // Team member color mapping
  const getTeamMemberColor = (userId: number | null) => {
    if (!userId) return "bg-gray-500 text-white";
    
    const userIndex = users.findIndex(user => user.id === userId);
    const colors = [
      "bg-blue-500 text-white",
      "bg-green-500 text-white", 
      "bg-purple-500 text-white",
      "bg-orange-500 text-white",
      "bg-pink-500 text-white",
      "bg-indigo-500 text-white",
      "bg-red-500 text-white",
      "bg-yellow-600 text-white",
      "bg-teal-500 text-white",
      "bg-violet-500 text-white",
    ];
    
    return userIndex >= 0 ? colors[userIndex % colors.length] : "bg-gray-500 text-white";
  };

  const getTeamMemberName = (userId: number | null) => {
    if (!userId) return "Unassigned";
    const user = users.find(u => u.id === userId);
    return user ? (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username) : "Unknown";
  };

  const getAppointmentColor = (type: string) => {
    switch (type) {
      case "meeting":
        return "bg-primary text-primary-foreground";
      case "consultation":
        return "bg-blue-500 text-white";
      case "demo":
        return "bg-purple-500 text-white";
      case "follow-up":
        return "bg-green-500 text-white";
      case "strategy":
        return "bg-orange-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getClientName = (clientId: number | null) => {
    if (!clientId) return "No client";
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.firstName} ${client.surname}` : "Client not found";
  };

  if (isLoading) {
    return (
      <div 
        className="p-6 min-h-screen transition-all duration-300"
        style={{
          backgroundColor: themes[theme].colors.background,
          color: themes[theme].colors.text,
        }}
      >
        <Card
          className="transition-all duration-300"
          style={{
            backgroundColor: themes[theme].colors.surface,
            borderColor: themes[theme].colors.border,
          }}
        >
          <CardContent className="p-6">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const days = getDaysInMonth();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const renderMonthView = () => (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {weekDays.map(day => (
          <div 
            key={day} 
            className="text-center py-2 text-sm font-medium transition-colors duration-300"
            style={{ color: themes[theme].colors.textSecondary }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const dayAppointments = getAppointmentsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isDayToday = isToday(day);

          return (
            <div 
              key={index} 
              className={`min-h-24 p-2 border transition-all duration-300 ${
                !isCurrentMonth ? 'opacity-50' : ''
              }`}
              style={{
                backgroundColor: isDayToday 
                  ? `${themes[theme].colors.primary}20` 
                  : (!isCurrentMonth ? themes[theme].colors.surface : themes[theme].colors.background),
                borderColor: isDayToday 
                  ? themes[theme].colors.primary 
                  : themes[theme].colors.border,
                color: themes[theme].colors.text,
              }}
            >
              <div 
                className={`text-sm mb-1 transition-colors duration-300 ${
                  isDayToday ? 'font-bold' : 
                  isCurrentMonth ? 'font-medium' : 'font-normal'
                }`}
                style={{
                  color: isDayToday 
                    ? themes[theme].colors.primary 
                    : (isCurrentMonth ? themes[theme].colors.text : themes[theme].colors.textSecondary)
                }}
              >
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1">
                {dayAppointments.map((appointment) => (
                  <div 
                    key={appointment.id}
                    className={`text-xs px-2 py-1 rounded transition-all duration-200 hover:shadow-md cursor-pointer ${getTeamMemberColor(appointment.assignedToId || appointment.userId)}`}
                    title={`Assigned to: ${getTeamMemberName(appointment.assignedToId || appointment.userId)}`}
                    onClick={() => {
                      setSelectedAppointment(appointment);
                      setIsDetailsModalOpen(true);
                    }}
                  >
                    <div className="font-medium">{appointment.startTime}</div>
                    <div className="truncate">{appointment.title}</div>
                    <div className="truncate text-xs opacity-90">
                      {getClientName(appointment.clientId)}
                    </div>
                    <div className="truncate text-xs opacity-75 font-medium">
                      {getTeamMemberName(appointment.assignedToId || appointment.userId)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderWeekView = () => {
    const weekDays = getDaysInWeek();
    
    return (
      <div className="space-y-4">
        {/* Week Header */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {weekDays.map(day => (
            <div 
              key={day.toISOString()} 
              className="text-center py-2 text-sm font-medium transition-colors duration-300"
              style={{ color: themes[theme].colors.textSecondary }}
            >
              <div>{format(day, 'EEE')}</div>
              <div className={`text-lg ${isToday(day) ? 'font-bold' : 'font-normal'}`}
                style={{ color: isToday(day) ? themes[theme].colors.primary : themes[theme].colors.text }}
              >
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Week Grid */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day, index) => {
            const dayAppointments = getAppointmentsForDate(day);
            const isDayToday = isToday(day);

            return (
              <div 
                key={index} 
                className="min-h-96 p-2 border transition-all duration-300"
                style={{
                  backgroundColor: isDayToday 
                    ? `${themes[theme].colors.primary}20` 
                    : themes[theme].colors.background,
                  borderColor: isDayToday 
                    ? themes[theme].colors.primary 
                    : themes[theme].colors.border,
                  color: themes[theme].colors.text,
                }}
              >
                <div className="space-y-1">
                  {dayAppointments.map((appointment) => (
                    <div 
                      key={appointment.id}
                      className={`text-xs px-2 py-1 rounded transition-all duration-200 hover:shadow-md cursor-pointer ${getTeamMemberColor(appointment.assignedToId || appointment.userId)}`}
                      title={`Assigned to: ${getTeamMemberName(appointment.assignedToId || appointment.userId)}`}
                      onClick={() => {
                        setSelectedAppointment(appointment);
                        setIsDetailsModalOpen(true);
                      }}
                    >
                      <div className="font-medium">{appointment.startTime}</div>
                      <div className="truncate">{appointment.title}</div>
                      <div className="truncate text-xs opacity-90">
                        {getClientName(appointment.clientId)}
                      </div>
                      <div className="truncate text-xs opacity-75 font-medium">
                        {getTeamMemberName(appointment.assignedToId || appointment.userId)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayAppointments = getAppointmentsForDate(currentDate);
    
    return (
      <div className="space-y-4">
        {/* Day Header */}
        <div className="text-center py-4 mb-4">
          <div 
            className="text-2xl font-bold transition-colors duration-300"
            style={{ color: themes[theme].colors.text }}
          >
            {format(currentDate, 'EEEE')}
          </div>
          <div 
            className="text-lg transition-colors duration-300"
            style={{ color: themes[theme].colors.textSecondary }}
          >
            {format(currentDate, 'MMMM d, yyyy')}
          </div>
        </div>

        {/* Day Grid */}
        <div className="space-y-1">
          {hours.map(hour => {
            const hourAppointments = getAppointmentsForHour(currentDate, hour);
            const hourTime = `${hour.toString().padStart(2, '0')}:00`;
            
            return (
              <div 
                key={hour}
                className="flex border-b transition-all duration-300"
                style={{
                  backgroundColor: themes[theme].colors.background,
                  borderColor: themes[theme].colors.border,
                }}
              >
                <div 
                  className="w-20 py-2 px-3 text-sm font-medium transition-colors duration-300"
                  style={{ color: themes[theme].colors.textSecondary }}
                >
                  {hourTime}
                </div>
                <div 
                  className="flex-1 p-2 min-h-16 transition-all duration-300"
                  style={{
                    backgroundColor: themes[theme].colors.surface,
                    color: themes[theme].colors.text,
                  }}
                >
                  <div className="space-y-1">
                    {hourAppointments.map((appointment) => (
                      <div 
                        key={appointment.id}
                        className={`text-sm px-3 py-2 rounded transition-all duration-200 hover:shadow-md cursor-pointer ${getTeamMemberColor(appointment.assignedToId || appointment.userId)}`}
                        title={`Assigned to: ${getTeamMemberName(appointment.assignedToId || appointment.userId)}`}
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setIsDetailsModalOpen(true);
                        }}
                      >
                        <div className="font-medium">{appointment.startTime} - {appointment.endTime}</div>
                        <div className="font-semibold">{appointment.title}</div>
                        <div className="text-sm opacity-90">
                          {getClientName(appointment.clientId)}
                        </div>
                        <div className="text-xs opacity-75 font-medium">
                          {getTeamMemberName(appointment.assignedToId || appointment.userId)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="p-6 space-y-6 relative min-h-screen overflow-x-hidden transition-all duration-300"
      style={{
        backgroundColor: themes[theme].colors.background,
        color: themes[theme].colors.text,
      }}
    >
      {/* Theme-aware background decoration */}
      <div 
        className="absolute inset-0 -z-10"
        style={{
          background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}05, transparent, ${themes[theme].colors.surface}30)`
        }}
      ></div>
      <div 
        className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl animate-pulse -z-10 transform translate-x-1/2 -translate-y-1/2"
        style={{
          background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}20, ${themes[theme].colors.secondary}20)`
        }}
      ></div>
      
      <Card
        className="backdrop-blur-sm shadow-xl transition-all duration-300"
        style={{
          backgroundColor: `${themes[theme].colors.surface}80`,
          borderColor: `${themes[theme].colors.border}50`,
        }}
      >
        <CardHeader>
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <CardTitle 
              className="transition-colors duration-300"
              style={{ color: themes[theme].colors.text }}
            >
              Calendar
            </CardTitle>
            
            <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
              {/* Navigation Controls */}
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('prev')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h4 
                  className="text-lg font-medium transition-colors duration-300 min-w-0"
                  style={{ color: themes[theme].colors.text }}
                >
                  {getViewTitle()}
                </h4>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('next')}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              {/* View Mode Buttons */}
              <div className="flex items-center space-x-1 border rounded-lg p-1" style={{ borderColor: themes[theme].colors.border }}>
                <Button 
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  className="text-xs"
                >
                  Month
                </Button>
                <Button 
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  className="text-xs"
                >
                  Week
                </Button>
                <Button 
                  variant={viewMode === "day" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("day")}
                  className="text-xs"
                >
                  Day
                </Button>
              </div>
              
              {/* Add Meeting Button */}
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 rounded-2xl px-4 py-2 font-medium group"
                style={{
                  background: themes[theme].colors.gradient,
                }}
              >
                <Plus className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-90" />
                Add Meeting
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'day' && renderDayView()}
        </CardContent>
      </Card>

      {/* Team Member Legend */}
      {users.length > 0 && (
        <Card 
          className="backdrop-blur-sm shadow-xl transition-all duration-300"
          style={{
            backgroundColor: `${themes[theme].colors.surface}80`,
            borderColor: `${themes[theme].colors.border}50`,
          }}
        >
          <CardHeader>
            <CardTitle 
              className="text-lg font-bold transition-colors duration-300 flex items-center"
              style={{ color: themes[theme].colors.text }}
            >
              <User className="w-5 h-5 mr-2" />
              Team Member Legend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center space-x-2">
                  <Badge 
                    className={`text-xs px-2 py-1 ${getTeamMemberColor(user.id)}`}
                  >
                    {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AddAppointmentModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />

      <AppointmentDetailsModal
        appointment={selectedAppointment}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedAppointment(null);
        }}
      />
    </div>
  );
}
