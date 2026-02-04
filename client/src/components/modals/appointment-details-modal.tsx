import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  Calendar,
  User,
  Users,
  MapPin,
  FileText,
  Phone,
  Mail,
  Edit3,
  Trash2,
} from "lucide-react";
import { type Appointment, type Client, type User as UserType } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

interface AppointmentDetailsModalProps {
  appointment: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (appointment: Appointment) => void;
  onDelete?: (appointmentId: number) => void;
}

export function AppointmentDetailsModal({
  appointment,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: AppointmentDetailsModalProps) {
  if (!appointment) return null;

  // Fetch client details if appointment has a client
  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: !!appointment.clientId,
  });

  // Fetch team members to get assigned user details
  const { data: teamMembers } = useQuery<UserType[]>({
    queryKey: ["/api/team-members"],
  });

  const client = appointment.clientId 
    ? clients?.find(c => c.id === appointment.clientId)
    : null;

  const assignedTeamMember = appointment.assignedToId 
    ? teamMembers?.find(tm => tm.id === appointment.assignedToId)
    : teamMembers?.find(tm => tm.id === appointment.userId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'rescheduled':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'consultation':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'follow-up':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'presentation':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'meeting':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>{appointment.title}</span>
            </span>
            <div className="flex items-center space-x-2">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(appointment)}
                  className="h-8 px-3"
                >
                  <Edit3 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(appointment.id)}
                  className="h-8 px-3"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </DialogTitle>
          <div className="sr-only">
            Appointment details for {appointment.title} scheduled on {format(new Date(appointment.date), 'MMMM d, yyyy')} from {appointment.startTime} to {appointment.endTime}
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Status and Type Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={getStatusColor(appointment.status)} variant="outline">
              {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </Badge>
            <Badge className={getTypeColor(appointment.type)} variant="outline">
              {appointment.type.charAt(0).toUpperCase() + appointment.type.slice(1)}
            </Badge>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-500" />
              <div>
                <p className="font-medium">Date</p>
                <p className="text-gray-600">
                  {format(new Date(appointment.date), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-gray-500" />
              <div>
                <p className="font-medium">Time</p>
                <p className="text-gray-600">
                  {appointment.startTime} - {appointment.endTime}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Client Information */}
          {client && (
            <>
              <div>
                <h3 className="flex items-center space-x-2 font-semibold mb-3">
                  <User className="w-5 h-5" />
                  <span>Client Information</span>
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium">{client.firstName} {client.surname}</p>
                      {client.employer && (
                        <p className="text-gray-600">{client.employer}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      {client.email && (
                        <div className="flex items-center space-x-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <span>{client.email}</span>
                        </div>
                      )}
                      {client.cellNumber && (
                        <div className="flex items-center space-x-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <span>{client.cellNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Assigned Team Member */}
          {assignedTeamMember && (
            <>
              <div>
                <h3 className="flex items-center space-x-2 font-semibold mb-3">
                  <Users className="w-5 h-5" />
                  <span>Assigned Team Member</span>
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="font-semibold text-blue-700">
                        {assignedTeamMember.firstName?.charAt(0)}{assignedTeamMember.lastName?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">
                        {assignedTeamMember.firstName} {assignedTeamMember.lastName}
                      </p>
                      <p className="text-sm text-gray-600 capitalize">
                        {assignedTeamMember.role}
                      </p>
                      {assignedTeamMember.email && (
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Mail className="w-3 h-3" />
                          <span>{assignedTeamMember.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Location */}
          {appointment.location && (
            <>
              <div>
                <h3 className="flex items-center space-x-2 font-semibold mb-3">
                  <MapPin className="w-5 h-5" />
                  <span>Location</span>
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p>{appointment.location}</p>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Description/Notes */}
          {appointment.description && (
            <div>
              <h3 className="flex items-center space-x-2 font-semibold mb-3">
                <FileText className="w-5 h-5" />
                <span>Description & Notes</span>
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="whitespace-pre-wrap">{appointment.description}</p>
              </div>
            </div>
          )}

          {/* Created/Updated Information */}
          <div className="text-sm text-gray-500 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {appointment.createdAt && (
                <div>
                  <p className="font-medium">Created</p>
                  <p>{format(new Date(appointment.createdAt), 'MMM d, yyyy \'at\' h:mm a')}</p>
                </div>
              )}

            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}