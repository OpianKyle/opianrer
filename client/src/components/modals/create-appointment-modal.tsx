import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { appointmentsApi } from "@/lib/api";
import { teamMembersApi } from "@/lib/team-api";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, isSameDay, isToday, isBefore, startOfDay } from "date-fns";
import { NotificationTriggers } from "@/lib/dynamic-notifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, CalendarPlus, Clock, User, Users, ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import type { Client } from "@shared/schema";

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

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
}

export default function CreateAppointmentModal({
  isOpen,
  onClose,
  client,
}: CreateAppointmentModalProps) {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignedToId: null as number | null,
    location: "",
    appointmentStatus: "scheduled",
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: appointments = [] } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: appointmentsApi.getAll,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["/api/team-members"],
    queryFn: teamMembersApi.getAll,
  });

  const createAppointmentMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: (newAppointment) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      // Trigger dynamic notification
      const clientName = client ? `${client.firstName} ${client.surname}` : 'Unknown Client';
      const dateStr = format(selectedDate, 'MMM dd, yyyy');
      NotificationTriggers.appointmentCreated(clientName, dateStr, selectedTime);
      
      toast({
        title: "Booking Confirmed!",
        description: "Appointment has been successfully scheduled.",
      });
      setStep(4); // Success step
    },
    onError: () => {
      toast({
        title: "Booking Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStep(1);
    setSelectedDate(new Date());
    setSelectedTime("");
    setSelectedType("");
    setFormData({
      title: "",
      description: "",
      assignedToId: null,
      location: "",
      appointmentStatus: "scheduled",
    });
  };

  const isTimeSlotAvailable = (date: Date, time: string) => {
    return !appointments.some(apt => {
      const aptDate = new Date(apt.date);
      if (!isSameDay(aptDate, date)) return false;
      
      // Check if this appointment conflicts with the assigned team member's schedule
      const isForAssignedPerson = formData.assignedToId 
        ? apt.assignedToId === formData.assignedToId
        : apt.userId === client?.userId && !apt.assignedToId;
      
      if (!isForAssignedPerson) return false;
      
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

  const calculateEndTime = (startTime: string, duration: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime("");
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
  };

  const handleTeamMemberSelect = (memberId: number | null) => {
    setFormData(prev => ({ ...prev, assignedToId: memberId }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client || !formData.title || !selectedDate || !selectedTime || !selectedType) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const selectedAppointmentType = APPOINTMENT_TYPES.find(type => type.value === selectedType);
    const duration = selectedAppointmentType?.duration || 60;
    const endTime = calculateEndTime(selectedTime, duration);

    const appointmentData = {
      ...formData,
      clientId: client.id,
      date: selectedDate,
      startTime: selectedTime,
      endTime: endTime,
      type: selectedType,
    };

    createAppointmentMutation.mutate(appointmentData);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!client) return null;

  const generateDateOptions = () => {
    const dates = [];
    for (let i = 0; i < 14; i++) {
      dates.push(addDays(new Date(), i));
    }
    return dates;
  };

  const selectedAppointmentType = APPOINTMENT_TYPES.find(type => type.value === selectedType);
  const availableSlots = getAvailableSlots(selectedDate);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CalendarPlus className="w-5 h-5 text-primary" />
            <span>Book Appointment for {client.firstName} {client.surname}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Step 1: Select Date */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Select Date</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  {generateDateOptions().map((date) => (
                    <Button
                      key={date.toISOString()}
                      variant={isSameDay(date, selectedDate) ? "default" : "outline"}
                      onClick={() => handleDateSelect(date)}
                      className={`p-3 h-auto flex flex-col items-center ${
                        isSameDay(date, selectedDate) 
                          ? "bg-primary text-primary-foreground" 
                          : ""
                      }`}
                    >
                      <span className="text-xs">{format(date, 'EEE')}</span>
                      <span className="text-lg font-semibold">{format(date, 'd')}</span>
                      <span className="text-xs">{format(date, 'MMM')}</span>
                      {isToday(date) && <Badge variant="secondary" className="mt-1 text-xs">Today</Badge>}
                    </Button>
                  ))}
                </div>
                <div className="flex justify-end mt-4">
                  <Button 
                    onClick={() => setStep(2)}
                    disabled={!selectedDate}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Next: Select Time
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Time */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>Select Time - {format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {availableSlots.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      onClick={() => handleTimeSelect(time)}
                      className={`p-2 ${
                        selectedTime === time 
                          ? "bg-primary text-primary-foreground" 
                          : ""
                      }`}
                    >
                      {time}
                    </Button>
                  ))}
                </div>
                {availableSlots.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No available time slots for this date.</p>
                    <p className="text-sm text-gray-400 mt-2">Please select a different date.</p>
                  </div>
                )}
                <div className="flex justify-between mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    onClick={() => setStep(3)}
                    disabled={!selectedTime}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Next: Select Type
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Select Type and Details */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Appointment Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="type">Appointment Type *</Label>
                    <Select value={selectedType} onValueChange={handleTypeSelect}>
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

                  <div>
                    <Label htmlFor="assignedTo">Assign Team Member</Label>
                    <Select 
                      value={formData.assignedToId?.toString() || "none"} 
                      onValueChange={(value) => handleTeamMemberSelect(value === "none" ? null : parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No assignment</SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id.toString()}>
                            {member.username} ({member.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      placeholder="Meeting title"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleInputChange("location", e.target.value)}
                      placeholder="Meeting room, address, or online"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      rows={3}
                      placeholder="Agenda, notes, or additional details"
                    />
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Appointment Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Date:</strong> {format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                        <p><strong>Time:</strong> {selectedTime} - {selectedAppointmentType ? calculateEndTime(selectedTime, selectedAppointmentType.duration) : ''}</p>
                      </div>
                      <div>
                        <p><strong>Duration:</strong> {selectedAppointmentType?.duration || 0} minutes</p>
                        <p><strong>Type:</strong> {selectedAppointmentType?.label}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button 
                      type="button"
                      variant="outline" 
                      onClick={() => setStep(2)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={createAppointmentMutation.isPending || !selectedType || !formData.title}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {createAppointmentMutation.isPending ? "Booking..." : "Book Appointment"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <Card>
              <CardContent className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Appointment Booked!</h3>
                <p className="text-gray-600 mb-4">
                  Your appointment has been successfully scheduled for {format(selectedDate, 'EEEE, MMMM d, yyyy')} at {selectedTime}.
                </p>
                <Button onClick={handleClose} className="bg-primary hover:bg-primary/90">
                  Close
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}