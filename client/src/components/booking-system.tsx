import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSameDay, isToday, isBefore, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { appointmentsApi } from "@/lib/api";
import { clientsApi } from "@/lib/api";
import { teamMembersApi } from "@/lib/team-api";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { useNotificationContext } from "@/contexts/notification-context";
import { useTheme } from "@/contexts/theme-context";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Users,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Plus
} from "lucide-react";

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", 
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
];

const APPOINTMENT_TYPES = [
  { value: "consultation", label: "Consultation", duration: 30 },
  { value: "meeting", label: "Business Meeting", duration: 60 },
  { value: "demo", label: "Product Demo", duration: 45 },
  { value: "follow-up", label: "Follow-up", duration: 30 },
  { value: "strategy", label: "Strategy Session", duration: 90 }
];

interface BookingSystemProps {
  onClose?: () => void;
}

export default function BookingSystem({ onClose }: BookingSystemProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { showNewAppointment } = useNotifications();
  const { theme, themes } = useTheme();
  
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [bookingData, setBookingData] = useState({
    title: "",
    description: "",
    clientId: null as number | null,
    assignedToId: null as number | null,
    location: "",
    bookingFor: "self" as "self" | "team_member" // New field to track booking type
  });
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

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



  const bookAppointmentMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: (newAppointment) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Booking Confirmed!",
        description: "Your appointment has been successfully scheduled.",
      });
      setStep(5); // Success step
      
      // Show push notification
      showNewAppointment({
        title: newAppointment.title,
        date: newAppointment.date,
        time: newAppointment.startTime,
        client: newAppointment.clientId ? `Client ${newAppointment.clientId}` : undefined
      });
    },
    onError: (error) => {
      toast({
        title: "Booking Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isTimeSlotAvailable = (date: Date, time: string) => {
    return !appointments.some(apt => {
      const aptDate = new Date(apt.date);
      if (!isSameDay(aptDate, date)) return false;
      
      // Check if this appointment conflicts with the selected person's schedule
      const isForSelectedPerson = bookingData.bookingFor === "self" 
        ? apt.userId === user?.id && !apt.assignedToId
        : apt.assignedToId === selectedPersonId;
      
      if (!isForSelectedPerson) return false;
      
      // Check if the time slot falls within the appointment's duration
      const startTime = apt.startTime;
      const endTime = apt.endTime;
      
      // Convert times to minutes for comparison
      const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      const slotMinutes = timeToMinutes(time);
      const aptStartMinutes = timeToMinutes(startTime);
      const aptEndMinutes = timeToMinutes(endTime);
      
      // Time slot is unavailable if it falls within the appointment duration
      return slotMinutes >= aptStartMinutes && slotMinutes < aptEndMinutes;
    });
  };

  const getAvailableSlots = (date: Date) => {
    if (isBefore(date, startOfDay(new Date()))) return [];
    
    return TIME_SLOTS.filter(time => isTimeSlotAvailable(date, time));
  };

  const handlePersonSelect = (bookingFor: "self" | "team_member", personId?: number) => {
    setBookingData({
      ...bookingData,
      bookingFor,
      assignedToId: bookingFor === "team_member" ? personId || null : null
    });
    setSelectedPersonId(bookingFor === "self" ? user?.id || null : personId || null);
    setStep(2);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime("");
    setStep(3);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep(4);
  };

  const handleBooking = () => {
    const selectedAppointmentType = APPOINTMENT_TYPES.find(type => type.value === selectedType);
    const endTime = selectedTime ? 
      `${String(Number(selectedTime.split(':')[0]) + Math.floor((selectedAppointmentType?.duration || 60) / 60)).padStart(2, '0')}:${String((Number(selectedTime.split(':')[1]) + (selectedAppointmentType?.duration || 60) % 60) % 60).padStart(2, '0')}` 
      : "";

    bookAppointmentMutation.mutate({
      title: bookingData.title,
      description: bookingData.description,
      clientId: bookingData.clientId,
      assignedToId: bookingData.bookingFor === "team_member" ? bookingData.assignedToId : null,
      date: selectedDate,
      startTime: selectedTime,
      endTime: endTime,
      type: selectedType,
      location: bookingData.location,
      status: "scheduled",
      userId: user?.id || 0
    });
  };

  const renderDatePicker = () => {
    const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 
              className="text-2xl font-bold mb-2 transition-colors duration-300"
              style={{ color: themes[theme].colors.text }}
            >
              Select Date
            </h2>
            <p 
              className="transition-colors duration-300"
              style={{ color: themes[theme].colors.textSecondary }}
            >
              {bookingData.bookingFor === "self" 
                ? "Choose your preferred appointment date" 
                : `Choose appointment date for ${teamMembers.find(m => m.id === bookingData.assignedToId)?.username || "team member"}`
              }
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setStep(1)}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {days.map((date) => {
            const availableSlots = getAvailableSlots(date);
            const bookedSlots = TIME_SLOTS.length - availableSlots.length;
            const isDisabled = availableSlots.length === 0;
            
            return (
              <Card 
                key={date.toISOString()} 
                className={`cursor-pointer transition-all duration-300 hover:shadow-md ${
                  isDisabled ? 'opacity-50' : ''
                }`}
                style={{
                  backgroundColor: themes[theme].colors.surface,
                  borderColor: isDisabled 
                    ? themes[theme].colors.border 
                    : (isSameDay(date, selectedDate) ? themes[theme].colors.primary : themes[theme].colors.border),
                  borderWidth: isSameDay(date, selectedDate) ? '2px' : '1px',
                }}
                onClick={() => !isDisabled && handleDateSelect(date)}
              >
                <CardContent className="p-4 text-center">
                  <div 
                    className="text-sm font-medium mb-1 transition-colors duration-300"
                    style={{ color: themes[theme].colors.textSecondary }}
                  >
                    {format(date, 'EEE')}
                  </div>
                  <div 
                    className="text-lg font-bold mb-2 transition-colors duration-300"
                    style={{ color: themes[theme].colors.text }}
                  >
                    {format(date, 'd')}
                  </div>
                  <div 
                    className="text-xs transition-colors duration-300"
                    style={{ color: themes[theme].colors.textSecondary }}
                  >
                    {format(date, 'MMM')}
                  </div>
                  {isToday(date) && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Today
                    </Badge>
                  )}
                  <div className="text-xs mt-2 space-y-1">
                    <div className={`${availableSlots.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {availableSlots.length} available
                    </div>
                    {bookedSlots > 0 && (
                      <div className="text-red-600">
                        {bookedSlots} booked
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimeSlots = () => {
    const availableSlots = getAvailableSlots(selectedDate);
    const bookedSlots = TIME_SLOTS.filter(time => !isTimeSlotAvailable(selectedDate, time));
    const bookedAppointments = appointments.filter(apt => {
      const aptDate = new Date(apt.date);
      return isSameDay(aptDate, selectedDate);
    });
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 
              className="text-2xl font-bold mb-2 transition-colors duration-300"
              style={{ color: themes[theme].colors.text }}
            >
              Select Time
            </h2>
            <p 
              className="transition-colors duration-300"
              style={{ color: themes[theme].colors.textSecondary }}
            >
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setStep(2)}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>
        </div>

        {/* Show booked appointments */}
        {bookedAppointments.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-800 mb-2">Existing Bookings for This Date:</h3>
            <div className="space-y-2">
              {bookedAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center space-x-2 text-sm">
                  <Clock className="w-4 h-4 text-red-600" />
                  <span className="text-red-700">
                    {apt.startTime} - {apt.endTime} | {apt.title}
                    {apt.assignedToId && teamMembers.find(tm => tm.id === apt.assignedToId) && 
                      ` (${teamMembers.find(tm => tm.id === apt.assignedToId)?.username})`
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {availableSlots.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Available Times</h3>
            <p className="text-gray-500">All time slots are booked for this date</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Available Time Slots</h3>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-gray-600">Available</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-gray-600">Booked</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {TIME_SLOTS.map((time) => {
                const isAvailable = isTimeSlotAvailable(selectedDate, time);
                const bookedApt = bookedAppointments.find(apt => {
                  const timeToMinutes = (timeStr: string) => {
                    const [hours, minutes] = timeStr.split(':').map(Number);
                    return hours * 60 + minutes;
                  };
                  
                  const slotMinutes = timeToMinutes(time);
                  const aptStartMinutes = timeToMinutes(apt.startTime);
                  const aptEndMinutes = timeToMinutes(apt.endTime);
                  
                  return slotMinutes >= aptStartMinutes && slotMinutes < aptEndMinutes;
                });
                
                return (
                  <div key={time} className="relative">
                    <Button
                      variant={isAvailable ? "outline" : "secondary"}
                      className={`h-12 w-full ${
                        isAvailable 
                          ? "hover:bg-primary hover:text-white border-green-300 text-green-700" 
                          : "bg-red-100 text-red-700 cursor-not-allowed border-red-300"
                      }`}
                      onClick={() => isAvailable && handleTimeSelect(time)}
                      disabled={!isAvailable}
                      title={!isAvailable && bookedApt ? `Booked: ${bookedApt.title} (${bookedApt.startTime} - ${bookedApt.endTime})` : ''}
                    >
                      {time}
                    </Button>
                    {!isAvailable && bookedApt && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        !
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPersonSelection = () => {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Who are you booking for?</h2>
          <p className="text-gray-600">Choose whether this appointment is for yourself or a team member</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* For Myself Option */}
          <div
            onClick={() => handlePersonSelect("self")}
            className={`cursor-pointer p-6 border-2 rounded-lg transition-all duration-200 ${
              bookingData.bookingFor === "self" 
                ? "border-primary bg-primary/5 shadow-lg" 
                : "border-gray-200 hover:border-gray-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">For Myself</h3>
                <p className="text-gray-600">Schedule an appointment for your own calendar</p>
                <p className="text-sm text-gray-500 mt-1">Booking as: {user?.username || "You"}</p>
              </div>
            </div>
          </div>

          {/* For Team Member Option */}
          <div
            onClick={() => teamMembers.length > 0 && setBookingData({ ...bookingData, bookingFor: "team_member" })}
            className={`cursor-pointer p-6 border-2 rounded-lg transition-all duration-200 ${
              bookingData.bookingFor === "team_member"
                ? "border-primary bg-primary/5 shadow-lg"
                : teamMembers.length > 0 
                  ? "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  : "border-gray-100 bg-gray-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">For Team Member</h3>
                <p className="text-gray-600">Assign this appointment to someone on your team</p>
                <p className="text-sm text-gray-500 mt-1">
                  {teamMembers.length > 0 ? `${teamMembers.length} team members available` : "No team members available"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Team Member Selection */}
        {bookingData.bookingFor === "team_member" && teamMembers.length > 0 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold text-gray-900">Select Team Member</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  onClick={() => handlePersonSelect("team_member", member.id)}
                  className={`cursor-pointer p-4 border rounded-lg transition-all duration-200 ${
                    bookingData.assignedToId === member.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{member.username}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        member.role === 'super_admin' ? 'bg-red-100 text-red-700' :
                        member.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                        member.role === 'user' ? 'bg-green-100 text-green-700' :
                        member.role === 'viewer' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {member.role?.replace('_', ' ').toUpperCase() || 'USER'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Continue Button */}
        <div className="flex justify-center">
          <Button 
            onClick={() => setStep(2)}
            className="px-8 py-3 text-white transition-all duration-300"
            style={{
              background: themes[theme].colors.gradient,
            }}
            disabled={bookingData.bookingFor === "team_member" && !bookingData.assignedToId}
          >
            Continue to Calendar
          </Button>
        </div>
      </div>
    );
  };

  const renderBookingForm = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 
              className="text-2xl font-bold mb-2 transition-colors duration-300"
              style={{ color: themes[theme].colors.text }}
            >
              Booking Details
            </h2>
            <p 
              className="transition-colors duration-300"
              style={{ color: themes[theme].colors.textSecondary }}
            >
              {format(selectedDate, 'EEEE, MMMM d')} at {selectedTime}
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setStep(2)}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>
        </div>
        
        <Card 
          className="transition-all duration-300"
          style={{
            backgroundColor: themes[theme].colors.surface,
            borderColor: themes[theme].colors.border,
          }}
        >
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appointment-type">Appointment Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select appointment type" />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label} ({type.duration} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter appointment title"
                value={bookingData.title}
                onChange={(e) => setBookingData({...bookingData, title: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="client">Client (Optional)</Label>
              <Select 
                value={bookingData.clientId?.toString() || ""} 
                onValueChange={(value) => setBookingData({...bookingData, clientId: value ? parseInt(value) : null})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id.toString()}>
                      {client.name} - {client.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            

            
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="Enter location or meeting link"
                value={bookingData.location}
                onChange={(e) => setBookingData({...bookingData, location: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add any additional details..."
                value={bookingData.description}
                onChange={(e) => setBookingData({...bookingData, description: e.target.value})}
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setStep(3)}
              >
                Back
              </Button>
              <Button 
                onClick={handleBooking}
                disabled={!selectedType || !bookingData.title || bookAppointmentMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {bookAppointmentMutation.isPending ? "Booking..." : "Confirm Booking"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSuccess = () => {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
          <p className="text-gray-600">
            {bookingData.bookingFor === "team_member" && bookingData.assignedToId
              ? `Appointment scheduled for ${teamMembers.find(m => m.id === bookingData.assignedToId)?.username} on ${format(selectedDate, 'EEEE, MMMM d')} at ${selectedTime}`
              : `Your appointment has been successfully scheduled for ${format(selectedDate, 'EEEE, MMMM d')} at ${selectedTime}`
            }
          </p>
          {bookingData.bookingFor === "team_member" && bookingData.assignedToId && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Assigned to:</span> {teamMembers.find(m => m.id === bookingData.assignedToId)?.username} ({teamMembers.find(m => m.id === bookingData.assignedToId)?.role?.replace('_', ' ').toUpperCase() || 'USER'})
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-center space-x-3">
          <Button 
            variant="outline" 
            onClick={() => {
              setStep(1);
              setSelectedDate(new Date());
              setSelectedTime("");
              setSelectedType("");
              setSelectedPersonId(null);
              setBookingData({
                title: "",
                description: "",
                clientId: null,
                assignedToId: null,
                location: "",
                bookingFor: "self"
              });
            }}
          >
            Book Another
          </Button>
          <Button 
            onClick={onClose}
            className="bg-primary hover:bg-primary/90"
          >
            Done
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="max-w-4xl mx-auto p-6 min-h-screen transition-all duration-300"
      style={{
        backgroundColor: themes[theme].colors.background,
        color: themes[theme].colors.text,
      }}
    >
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 
            className="text-3xl font-bold transition-colors duration-300"
            style={{ color: themes[theme].colors.text }}
          >
            Book Appointment
          </h1>
          {onClose && (
            <Button variant="ghost" onClick={onClose} size="sm">
              ×
            </Button>
          )}
        </div>
        
        {/* Progress indicator */}
        <div className="flex items-center space-x-4 mb-8">
          {[1, 2, 3, 4, 5].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                  step >= stepNum 
                    ? 'text-white shadow-lg' 
                    : 'text-gray-600'
                }`}
                style={{
                  backgroundColor: step >= stepNum 
                    ? themes[theme].colors.primary 
                    : themes[theme].colors.surface,
                  borderColor: themes[theme].colors.border,
                  borderWidth: '1px',
                }}
              >
                {stepNum}
              </div>
              {stepNum < 5 && (
                <div 
                  className={`w-12 h-0.5 mx-2 transition-all duration-300`}
                  style={{
                    backgroundColor: step > stepNum 
                      ? themes[theme].colors.primary 
                      : themes[theme].colors.border,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      
      {step === 1 && renderPersonSelection()}
      {step === 2 && renderDatePicker()}
      {step === 3 && renderTimeSlots()}
      {step === 4 && renderBookingForm()}
      {step === 5 && renderSuccess()}
    </div>
  );
}