import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi, appointmentsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/theme-context";
import { NotificationTriggers } from "@/lib/dynamic-notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Users, 
  Edit, 
  CalendarPlus, 
  Upload, 
  Trash2,
  Plus,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import CdnQuotationForm from "@/components/forms/cdn-quotation-form";
import ComprehensiveClientModal from "@/components/modals/comprehensive-client-modal";
import CreateAppointmentModal from "@/components/modals/create-appointment-modal";
import EditClientModal from "@/components/modals/edit-client-modal";
import ClientDocuments from "@/components/client-documents";
import type { Client, Appointment } from "@shared/schema";

export default function Clients() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme, themes } = useTheme();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: clientsApi.getAll,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: () => fetch("/api/users").then(res => res.json()),
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: appointmentsApi.getAll,
  });

  const deleteClientMutation = useMutation({
    mutationFn: clientsApi.delete,
    onSuccess: (_, clientId) => {
      const client = clients.find(c => c.id === clientId);
      const clientName = client ? `${client.firstName} ${client.surname}` : 'Client';
      
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      
      // Trigger dynamic notification
      NotificationTriggers.clientDeleted(clientName);
      
      toast({
        title: "Success",
        description: "Client deleted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete client. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredClients = clients.filter(client => {
    if (statusFilter === "all") return true;
    return client.status === statusFilter;
  });

  const getCreatedByName = (userId: number | null) => {
    if (!userId) return "Unknown";
    const user = users.find(u => u.id === userId);
    return user ? (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username) : "Unknown";
  };

  const handleDeleteClient = (id: number) => {
    if (window.confirm("Are you sure you want to delete this client?")) {
      deleteClientMutation.mutate(id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-secondary/10 text-secondary";
      case "prospect":
        return "bg-warning/10 text-warning";
      case "inactive":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getAppointmentStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "no_show":
        return "bg-orange-100 text-orange-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getAppointmentStatusIcon = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Calendar className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "cancelled":
        return <XCircle className="w-4 h-4" />;
      case "no_show":
        return <AlertCircle className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getClientAppointments = (clientId: number) => {
    return appointments.filter(appointment => appointment.clientId === clientId);
  };

  const getClientAppointmentStatus = (clientId: number) => {
    const clientAppointments = getClientAppointments(clientId);
    if (clientAppointments.length === 0) return "no_appointments";
    
    const hasScheduled = clientAppointments.some(app => app.appointmentStatus === "scheduled");
    const hasPending = clientAppointments.some(app => app.appointmentStatus === "pending");
    const hasCompleted = clientAppointments.some(app => app.appointmentStatus === "completed");
    
    if (hasScheduled) return "scheduled";
    if (hasPending) return "pending";
    if (hasCompleted) return "completed";
    return "no_appointments";
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
          className="backdrop-blur-sm shadow-xl border transition-all duration-300"
          style={{
            backgroundColor: themes[theme].colors.glassBg,
            borderColor: themes[theme].colors.border,
          }}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}05, transparent, ${themes[theme].colors.secondary}30)`
        }}
      ></div>
      <div 
        className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl animate-pulse -z-10 transform translate-x-1/2 -translate-y-1/2"
        style={{
          background: `linear-gradient(to bottom right, ${themes[theme].colors.primary}20, ${themes[theme].colors.secondary}20)`
        }}
      ></div>
      
      <Card 
        className="backdrop-blur-sm shadow-xl border transition-all duration-300"
        style={{
          backgroundColor: themes[theme].colors.glassBg,
          borderColor: themes[theme].colors.border,
        }}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle 
              className="text-2xl font-bold transition-colors duration-300"
              style={{ color: themes[theme].colors.text }}
            >
              Client Management
            </CardTitle>
            <div className="flex items-center space-x-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="prospect">Prospects</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 rounded-2xl px-6 py-3 font-medium group"
              >
                <Plus className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-90" />
                Add Client
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-textPrimary mb-2">
                {statusFilter === "all" ? "No clients found" : `No ${statusFilter} clients found`}
              </h3>
              <p className="text-gray-500 mb-4">
                {statusFilter === "all" 
                  ? "Get started by adding your first client."
                  : `Try adjusting your filter or add a new client.`
                }
              </p>
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 rounded-2xl px-6 py-3 font-medium group"
              >
                <Plus className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-90" />
                Add Client
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Appointment Status</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-textPrimary">{client.firstName} {client.surname}</div>
                            <div className="text-sm text-gray-500">{client.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-textPrimary">{client.employer || '-'}</div>
                        <div className="text-sm text-gray-500">{client.occupation || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(client.status)}>
                          {client.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-textPrimary">
                          {getCreatedByName(client.userId)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getAppointmentStatusIcon(getClientAppointmentStatus(client.id))}
                          <Badge className={getAppointmentStatusColor(getClientAppointmentStatus(client.id))}>
                            {getClientAppointmentStatus(client.id) === "no_appointments" ? "No Appointments" : getClientAppointmentStatus(client.id)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {format(new Date(client.lastContact || client.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-textPrimary">
                        ${client.value?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedClient(client);
                              setIsEditModalOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedClient(client);
                              setIsAppointmentModalOpen(true);
                            }}
                          >
                            <CalendarPlus className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedClient(client);
                              setIsDocumentsModalOpen(true);
                            }}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            title="CDN Quotation"
                            onClick={() => {
                              setSelectedClient(client);
                              setIsQuotationModalOpen(true);
                            }}
                          >
                            <Plus className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteClient(client.id)}
                            disabled={deleteClientMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ComprehensiveClientModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
      
      <CreateAppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => {
          setIsAppointmentModalOpen(false);
          setSelectedClient(null);
        }}
        client={selectedClient}
      />
      
      <EditClientModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedClient(null);
        }}
        client={selectedClient}
      />
      
      <Dialog open={isDocumentsModalOpen} onOpenChange={setIsDocumentsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Documents - {selectedClient?.firstName} {selectedClient?.surname}
            </DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <ClientDocuments clientId={selectedClient.id} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isQuotationModalOpen} onOpenChange={setIsQuotationModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              CDN Quotation - {selectedClient?.firstName} {selectedClient?.surname}
            </DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <CdnQuotationForm 
              clientId={selectedClient.id} 
              onSuccess={() => setIsQuotationModalOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
