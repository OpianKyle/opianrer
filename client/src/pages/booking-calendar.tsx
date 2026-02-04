import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, startOfWeek, endOfWeek, startOfDay, endOfDay, eachHourOfInterval } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { appointmentsApi, clientsApi } from "@/lib/api";
import { teamMembersApi } from "@/lib/team-api";
import { ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { AppointmentDetailsModal } from "@/components/modals/appointment-details-modal";
import { type Appointment } from "@shared/schema";

export default function BookingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const { theme, themes } = useTheme();

  const { data: appointments = [] } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: appointmentsApi.getAll,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: clientsApi.getAll,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["/api/team-members"],
    queryFn: teamMembersApi.getAll,
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

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

  const getDaysInWeek = () => {
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.date);
      return isSameDay(aptDate, date);
    });
  };

  const getAppointmentsForHour = (date: Date, hour: number) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.date);
      const aptHour = parseInt(apt.startTime.split(':')[0]);
      return aptDate.toDateString() === date.toDateString() && aptHour === hour;
    });
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

  const getClientName = (clientId: number | null) => {
    if (!clientId) return "No client";
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.firstName} ${client.surname}` : "Unknown client";
  };



  // Team member colors - consistent across the application
  const getTeamMemberColor = (assignedToId: number | null) => {
    if (!assignedToId) return "bg-gray-100 text-gray-800 border-gray-200";
    
    const colors = [
      "bg-blue-100 text-blue-800 border-blue-200", // Blue
      "bg-green-100 text-green-800 border-green-200", // Green  
      "bg-purple-100 text-purple-800 border-purple-200", // Purple
      "bg-orange-100 text-orange-800 border-orange-200", // Orange
      "bg-pink-100 text-pink-800 border-pink-200", // Pink
      "bg-yellow-100 text-yellow-800 border-yellow-200", // Yellow
      "bg-indigo-100 text-indigo-800 border-indigo-200", // Indigo
      "bg-red-100 text-red-800 border-red-200", // Red
    ];
    
    return colors[assignedToId % colors.length];
  };

  const getTeamMemberInfo = (assignedToId: number | null) => {
    if (!assignedToId) return null;
    const member = teamMembers.find(tm => tm.id === assignedToId);
    return member;
  };

  const getTeamMemberName = (assignedToId: number | null) => {
    if (!assignedToId) return "Unassigned";
    const member = teamMembers.find(tm => tm.id === assignedToId);
    if (!member) return "Unknown";
    return member.name || "Unknown";
  };

  const selectedDateAppointments = selectedDate ? getAppointmentsForDate(selectedDate) : [];

  const renderCalendarView = () => {
    if (viewMode === 'month') {
      return (
        <>
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs sm:text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {monthDays.map((date) => {
              const dayAppointments = getAppointmentsForDate(date);
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              
              return (
                <div
                  key={date.toISOString()}
                  className={`
                    min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 border rounded-lg cursor-pointer transition-all
                    ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}
                    ${isToday(date) ? 'bg-blue-50 border-blue-300' : ''}
                    ${!isSameMonth(date, currentDate) ? 'opacity-50' : ''}
                  `}
                  onClick={() => setSelectedDate(date)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs sm:text-sm font-medium ${
                      isToday(date) ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {format(date, 'd')}
                    </span>
                    {dayAppointments.length > 0 && (
                      <Badge variant="secondary" className="text-xs px-1 py-0.5">
                        {dayAppointments.length}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 2).map((apt) => (
                      <div
                        key={apt.id}
                        className={`text-xs p-1 rounded border cursor-pointer hover:shadow-sm ${getTeamMemberColor(apt.assignedToId)}`}
                        title={`${apt.startTime} - ${apt.endTime}: ${apt.title} (${getClientName(apt.clientId)}) - Assigned to: ${getTeamMemberName(apt.assignedToId) || 'Unassigned'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAppointment(apt);
                          setIsDetailsModalOpen(true);
                        }}
                      >
                        <div className="truncate font-medium">{apt.startTime}-{apt.endTime.slice(0, 5)} {apt.title}</div>
                        <div className="truncate opacity-70">{getClientName(apt.clientId)}</div>
                      </div>
                    ))}
                    {dayAppointments.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{dayAppointments.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      );
    }

    if (viewMode === 'week') {
      const weekDays = getDaysInWeek();
      const hours = Array.from({ length: 24 }, (_, i) => i);
      
      return (
        <>
          <div className="grid grid-cols-8 gap-1 mb-4">
            <div className="text-center text-xs sm:text-sm font-medium text-gray-500 py-2">Time</div>
            {weekDays.map(day => (
              <div key={day.toISOString()} className="text-center text-xs sm:text-sm font-medium text-gray-500 py-2">
                <div>{format(day, 'EEE')}</div>
                <div className={`text-sm sm:text-lg ${isToday(day) ? 'font-bold text-blue-600' : 'font-normal text-gray-900'}`}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {hours.map(hour => (
              <div key={hour} className="grid grid-cols-8 border-b border-gray-100 last:border-b-0">
                {/* Time column */}
                <div className="bg-gray-50 p-1 sm:p-2 text-xs font-medium text-gray-500 border-r border-gray-200 flex items-center">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                
                {/* Day columns */}
                {weekDays.map((day, dayIndex) => {
                  const hourAppointments = getAppointmentsForHour(day, hour);
                  const isDayToday = isToday(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <div 
                      key={`${day.toISOString()}-${hour}`}
                      className={`
                        min-h-8 sm:min-h-12 p-0.5 sm:p-1 border-r border-gray-100 last:border-r-0 cursor-pointer transition-all hover:bg-gray-50
                        ${isSelected ? 'bg-primary/5' : ''}
                        ${isDayToday ? 'bg-blue-25' : ''}
                      `}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className="space-y-1">
                        {hourAppointments.map((appointment) => (
                          <div 
                            key={appointment.id}
                            className={`text-xs p-0.5 sm:p-1 rounded border cursor-pointer hover:shadow-sm ${getTeamMemberColor(appointment.assignedToId)}`}
                            title={`${appointment.startTime} - ${appointment.endTime}: ${appointment.title} (${getClientName(appointment.clientId)}) - Assigned to: ${getTeamMemberName(appointment.assignedToId) || 'Unassigned'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppointment(appointment);
                              setIsDetailsModalOpen(true);
                            }}
                          >
                            <div className="font-medium truncate text-xs">{appointment.title}</div>
                            <div className="truncate opacity-70 text-xs hidden sm:block">{getClientName(appointment.clientId)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      );
    }

    if (viewMode === 'day') {
      return (
        <div className="space-y-4">
          <div className="text-center py-4 mb-4">
            <div className="text-2xl font-bold text-gray-900">
              {format(currentDate, 'EEEE')}
            </div>
            <div className="text-lg text-gray-600">
              {format(currentDate, 'MMMM d, yyyy')}
            </div>
          </div>

          <div className="space-y-1">
            {Array.from({ length: 24 }, (_, i) => i).map(hour => {
              const hourAppointments = getAppointmentsForHour(currentDate, hour);
              const hourTime = `${hour.toString().padStart(2, '0')}:00`;
              
              return (
                <div key={hour} className="flex border-b border-gray-200">
                  <div className="w-20 py-2 px-3 text-sm font-medium text-gray-500">
                    {hourTime}
                  </div>
                  <div className="flex-1 p-2 min-h-16 bg-gray-50">
                    <div className="space-y-1">
                      {hourAppointments.map((appointment) => (
                        <div 
                          key={appointment.id}
                          className={`text-sm px-3 py-2 rounded border cursor-pointer hover:shadow-sm ${getTeamMemberColor(appointment.assignedToId)}`}
                          onClick={() => {
                            setSelectedAppointment(appointment);
                            setIsDetailsModalOpen(true);
                          }}
                          title={`${appointment.startTime} - ${appointment.endTime}: ${appointment.title} (${getClientName(appointment.clientId)}) - Assigned to: ${getTeamMemberName(appointment.assignedToId) || 'Unassigned'}`}
                        >
                          <div className="font-medium">{appointment.startTime} - {appointment.endTime}</div>
                          <div className="font-semibold">{appointment.title}</div>
                          <div className="text-sm opacity-70">{getClientName(appointment.clientId)}</div>
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
    }

    return null;
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Booking Calendar</h1>
        <p className="text-sm sm:text-base text-gray-600">View all scheduled appointments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Calendar View */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
              <CardTitle>Calendar</CardTitle>
              
              <div className="flex flex-col space-y-3 lg:flex-row lg:items-center lg:space-y-0 lg:space-x-4">
                {/* Navigation Controls */}
                <div className="flex items-center justify-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate('prev')}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h4 className="text-sm sm:text-lg font-medium min-w-0 text-center">
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
                <div className="flex items-center justify-center space-x-1 border rounded-lg p-1">
                  <Button 
                    variant={viewMode === "month" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("month")}
                    className="text-xs px-2 py-1"
                  >
                    Month
                  </Button>
                  <Button 
                    variant={viewMode === "week" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("week")}
                    className="text-xs px-2 py-1"
                  >
                    Week
                  </Button>
                  <Button 
                    variant={viewMode === "day" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("day")}
                    className="text-xs px-2 py-1"
                  >
                    Day
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderCalendarView()}
          </CardContent>
        </Card>

        {/* Sidebar with Details and Legend */}
        <div className="space-y-6">
          {/* Team Member Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Team Member Colors</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center space-x-2">
                    <div className={`w-4 h-4 rounded border ${getTeamMemberColor(member.id)}`}></div>
                    <span className="text-sm font-medium">
                      {member.name}
                    </span>
                    <span className="text-xs text-gray-500">({member.role})</span>
                  </div>
                ))}
                <div className="flex items-center space-x-2 pt-1 border-t">
                  <div className="w-4 h-4 rounded border bg-gray-100 border-gray-200"></div>
                  <span className="text-sm font-medium text-gray-500">Unassigned</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appointment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>
                  {selectedDate 
                    ? format(selectedDate, 'MMMM d, yyyy')
                    : 'Select a date'
                  }
                </span>
              </CardTitle>
            </CardHeader>
          <CardContent>
            {selectedDate ? (
              selectedDateAppointments.length > 0 ? (
                <div className="space-y-4">
                  {selectedDateAppointments.map((apt) => (
                    <div 
                      key={apt.id} 
                      className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => {
                        setSelectedAppointment(apt);
                        setIsDetailsModalOpen(true);
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{apt.title}</h4>
                        <Badge variant={apt.status === 'scheduled' ? 'default' : 'secondary'}>
                          {apt.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4" />
                          <span>{apt.startTime} - {apt.endTime}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4" />
                          <span>{getClientName(apt.clientId)}</span>
                        </div>
                        {getTeamMemberInfo(apt.assignedToId) && (
                          <div className="flex items-center space-x-2 mt-2">
                            <Users className="w-4 h-4" />
                            <span className={`text-xs px-2 py-1 rounded ${getTeamMemberColor(apt.assignedToId)}`}>
                              {getTeamMemberName(apt.assignedToId)}
                            </span>
                          </div>
                        )}
                        {apt.description && (
                          <p className="text-gray-700 mt-2">{apt.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No appointments scheduled for this date</p>
                </div>
              )
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Select a date to view appointments</p>
              </div>
            )}
            </CardContent>
          </Card>
        </div>
      </div>

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