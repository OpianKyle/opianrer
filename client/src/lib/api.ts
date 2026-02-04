import { apiRequest } from "./queryClient";
import type { Client, InsertClient, Document, Appointment, InsertAppointment } from "@shared/schema";

export const clientsApi = {
  getAll: (): Promise<Client[]> => 
    fetch("/api/clients").then(res => res.json()),
  
  getById: (id: number): Promise<Client> =>
    fetch(`/api/clients/${id}`).then(res => res.json()),
  
  create: (client: InsertClient): Promise<Client> =>
    apiRequest("POST", "/api/clients", client).then(res => res.json()),
  
  update: (id: number, client: Partial<InsertClient>): Promise<Client> =>
    apiRequest("PUT", `/api/clients/${id}`, client).then(res => res.json()),
  
  delete: (id: number): Promise<void> =>
    apiRequest("DELETE", `/api/clients/${id}`).then(() => {}),
};

export const documentsApi = {
  getAll: (): Promise<Document[]> =>
    fetch("/api/documents").then(res => res.json()),
  
  getByClient: (clientId: number): Promise<Document[]> =>
    fetch(`/api/documents/client/${clientId}`).then(res => res.json()),
  
  upload: (file: File, clientId?: number): Promise<Document> => {
    const formData = new FormData();
    formData.append("file", file);
    if (clientId) {
      formData.append("clientId", clientId.toString());
    }
    
    return fetch("/api/documents", {
      method: "POST",
      body: formData,
    }).then(res => res.json());
  },
  
  delete: (id: number): Promise<void> =>
    apiRequest("DELETE", `/api/documents/${id}`).then(() => {}),
    
  download: (id: number): void => {
    window.open(`/api/documents/${id}/download`, '_blank');
  },
};

export const appointmentsApi = {
  getAll: (): Promise<Appointment[]> =>
    fetch("/api/appointments").then(res => res.json()),
  
  getByClient: (clientId: number): Promise<Appointment[]> =>
    fetch(`/api/clients/${clientId}/appointments`).then(res => res.json()),
  
  create: (appointment: InsertAppointment): Promise<Appointment> =>
    apiRequest("POST", "/api/appointments", appointment).then(res => res.json()),
  
  update: (id: number, appointment: Partial<InsertAppointment>): Promise<Appointment> =>
    apiRequest("PUT", `/api/appointments/${id}`, appointment).then(res => res.json()),
  
  delete: (id: number): Promise<void> =>
    apiRequest("DELETE", `/api/appointments/${id}`).then(() => {}),
};

export const statsApi = {
  get: (): Promise<{
    totalClients: number;
    activeProjects: number;
    upcomingMeetings: number;
    revenue: number;
  }> => fetch("/api/stats").then(res => res.json()),
};
