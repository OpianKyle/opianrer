import { 
  clients, 
  documents, 
  appointments, 
  users, 
  teamMembers,
  kanbanBoards, 
  kanbanColumns, 
  kanbanCards,
  kanbanTasks,
  cdnQuotations,
  type Client, 
  type InsertClient, 
  type Document, 
  type InsertDocument, 
  type Appointment, 
  type InsertAppointment, 
  type User, 
  type InsertUser,
  type KanbanBoard,
  type KanbanColumn,
  type KanbanCard,
  type KanbanTask,
  type InsertKanbanBoard,
  type InsertKanbanColumn,
  type InsertKanbanCard,
  type InsertKanbanTask,
  type CdnQuotation,
  type InsertCdnQuotation
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Client methods
  getClients(userId?: number, userRole?: string): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;
  
  // Document methods
  getDocuments(userId?: number, userRole?: string): Promise<Document[]>;
  getDocumentsByClient(clientId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Appointment methods
  getAppointments(userId?: number, userRole?: string): Promise<Appointment[]>;
  getAppointmentsByClient(clientId: number): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;
  
  // User methods (team members are users)
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Stats methods
  getStats(userId?: number, userRole?: string): Promise<{
    totalClients: number;
    activeProjects: number;
    upcomingMeetings: number;
    revenue: number;
  }>;
  
  // Kanban methods
  getKanbanBoards(userId?: number): Promise<KanbanBoard[]>;
  getKanbanBoard(id: number): Promise<KanbanBoard | undefined>;
  createKanbanBoard(board: InsertKanbanBoard): Promise<KanbanBoard>;
  updateKanbanBoard(id: number, board: Partial<InsertKanbanBoard>): Promise<KanbanBoard | undefined>;
  deleteKanbanBoard(id: number): Promise<boolean>;
  
  getKanbanColumns(boardId: number): Promise<KanbanColumn[]>;
  createKanbanColumn(column: InsertKanbanColumn): Promise<KanbanColumn>;
  updateKanbanColumn(id: number, column: Partial<InsertKanbanColumn>): Promise<KanbanColumn | undefined>;
  deleteKanbanColumn(id: number): Promise<boolean>;
  
  getKanbanCards(columnId: number): Promise<KanbanCard[]>;
  getKanbanCard(id: number): Promise<KanbanCard | undefined>;
  createKanbanCard(card: InsertKanbanCard): Promise<KanbanCard>;
  updateKanbanCard(id: number, card: Partial<InsertKanbanCard>): Promise<KanbanCard | undefined>;
  deleteKanbanCard(id: number): Promise<boolean>;
  moveKanbanCard(cardId: number, newColumnId: number, newPosition: number): Promise<KanbanCard | undefined>;
  
  // Task methods
  getKanbanTasks(cardId: number): Promise<KanbanTask[]>;
  getKanbanTask(id: number): Promise<KanbanTask | undefined>;
  createKanbanTask(task: InsertKanbanTask): Promise<KanbanTask>;
  updateKanbanTask(id: number, task: Partial<InsertKanbanTask>): Promise<KanbanTask | undefined>;
  // CDN Quotation methods
  getCdnQuotations(clientId: number): Promise<CdnQuotation[]>;
  createCdnQuotation(quotation: InsertCdnQuotation): Promise<CdnQuotation>;
  getCdnQuotation(id: number): Promise<CdnQuotation | undefined>;
}

// DatabaseStorage implementation
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Client methods - Role-based filtering
  async getClients(userId?: number, userRole?: string): Promise<Client[]> {
    if (userRole === 'advisor' && userId) {
      // Advisors see only their own clients
      return await db.select().from(clients).where(eq(clients.userId, userId));
    }
    // All other roles see all clients
    return await db.select().from(clients);
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    // Process the data to convert empty strings to null and handle type conversion
    const processedData = Object.fromEntries(
      Object.entries(insertClient).map(([key, value]) => {
        // Convert empty strings to null (especially important for email field)
        if (value === "" || value === undefined) {
          return [key, null];
        }
        
        // Convert string numbers to actual numbers for numeric fields
        const numericFields = [
          'grossAnnualIncome', 'dutySplitAdmin', 'dutySplitTravel', 'dutySplitSupervision', 'dutySplitManual',
          'monthlyIncome', 'spouseGrossAnnualIncome', 'spouseMonthlyIncome', 'pensionFundCurrentValue',
          'pensionFundProjectedValue', 'providentFundCurrentValue', 'providentFundProjectedValue',
          'groupLifeCover', 'groupDisabilityCover', 'groupDreadDiseaseCover', 'disabilityIncomeCover',
          'medicalAidMembers', 'deathMonthlyIncome', 'disabilityCapitalExpenses', 'disabilityMonthlyIncome',
          'dreadDiseaseCover', 'retirementAge', 'retirementMonthlyIncome', 'childrenEducationAmount',
          'childrenEducationYear', 'expectedInvestmentReturns', 'expectedInflation', 'value',
          'spouseDutySplitAdmin', 'spouseDutySplitTravel', 'spouseDutySplitSupervision', 'spouseDutySplitManual'
        ];
        
        if (numericFields.includes(key) && typeof value === 'string') {
          const numValue = parseFloat(value);
          return [key, isNaN(numValue) ? null : numValue];
        }
        
        return [key, value];
      })
    );

    console.log("Processed client data:", processedData);
    
    const [client] = await db
      .insert(clients)
      .values(processedData as InsertClient)
      .returning();
    return client;
  }

  async updateClient(id: number, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    // Process the update data the same way as createClient
    const processedData = Object.fromEntries(
      Object.entries(updateData).map(([key, value]) => {
        // Convert empty strings to null
        if (value === "" || value === undefined) {
          return [key, null];
        }
        
        // Convert string numbers to actual numbers for numeric fields
        const numericFields = [
          'grossAnnualIncome', 'dutySplitAdmin', 'dutySplitTravel', 'dutySplitSupervision', 'dutySplitManual',
          'monthlyIncome', 'spouseGrossAnnualIncome', 'spouseMonthlyIncome', 'pensionFundCurrentValue',
          'pensionFundProjectedValue', 'providentFundCurrentValue', 'providentFundProjectedValue',
          'groupLifeCover', 'groupDisabilityCover', 'groupDreadDiseaseCover', 'disabilityIncomeCover',
          'medicalAidMembers', 'deathMonthlyIncome', 'disabilityCapitalExpenses', 'disabilityMonthlyIncome',
          'dreadDiseaseCover', 'retirementAge', 'retirementMonthlyIncome', 'childrenEducationAmount',
          'childrenEducationYear', 'expectedInvestmentReturns', 'expectedInflation', 'value',
          'spouseDutySplitAdmin', 'spouseDutySplitTravel', 'spouseDutySplitSupervision', 'spouseDutySplitManual'
        ];
        
        if (numericFields.includes(key) && typeof value === 'string') {
          const numValue = parseFloat(value);
          return [key, isNaN(numValue) ? null : numValue];
        }
        
        return [key, value];
      })
    );

    const [client] = await db
      .update(clients)
      .set({
        ...processedData,
        lastContact: new Date(),
      })
      .where(eq(clients.id, id))
      .returning();
    return client || undefined;
  }

  async deleteClient(id: number): Promise<boolean> {
    try {
      // Delete related kanban cards
      await db.delete(kanbanCards).where(eq(kanbanCards.clientId, id));
      
      // Delete related appointments
      await db.delete(appointments).where(eq(appointments.clientId, id));
      
      // Delete related documents
      await db.delete(documents).where(eq(documents.clientId, id));
      
      // Delete the client
      const result = await db.delete(clients).where(eq(clients.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting client:', error);
      throw error;
    }
  }

  // Document methods
  async getDocuments(userId?: number, userRole?: string): Promise<Document[]> {
    if (userId && userRole !== 'admin' && userRole !== 'super_admin') {
      // Regular users see only their own documents
      return await db.select().from(documents).where(eq(documents.userId, userId));
    }
    // Admin and super admin users see all documents
    return await db.select().from(documents);
  }

  async getDocumentsByClient(clientId: number): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.clientId, clientId));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values({
        name: insertDocument.name,
        originalName: insertDocument.originalName,
        size: insertDocument.size,
        type: insertDocument.type,
        clientId: insertDocument.clientId ?? null,
        userId: insertDocument.userId ?? null,
      })
      .returning();
    return document;
  }

  async deleteDocument(id: number): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Appointment methods
  async getAppointments(userId?: number, userRole?: string): Promise<Appointment[]> {
    if (userRole === 'advisor' && userId) {
      // Advisors see only appointments for their own clients
      return await db.select({
        id: appointments.id,
        title: appointments.title,
        description: appointments.description,
        clientId: appointments.clientId,
        userId: appointments.userId,
        assignedToId: appointments.assignedToId,
        date: appointments.date,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        type: appointments.type,
        location: appointments.location,
        status: appointments.status,
        appointmentStatus: appointments.appointmentStatus,
        createdAt: appointments.createdAt,
      }).from(appointments)
        .innerJoin(clients, eq(appointments.clientId, clients.id))
        .where(eq(clients.userId, userId));
    }
    // All other roles see all appointments
    return await db.select().from(appointments);
  }

  async getAppointmentsByClient(clientId: number): Promise<Appointment[]> {
    return await db.select().from(appointments).where(eq(appointments.clientId, clientId));
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment || undefined;
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const [appointment] = await db
      .insert(appointments)
      .values({
        title: insertAppointment.title,
        description: insertAppointment.description ?? null,
        clientId: insertAppointment.clientId ?? null,
        userId: insertAppointment.userId ?? null,
        assignedToId: insertAppointment.assignedToId ?? null,
        date: new Date(insertAppointment.date),
        startTime: insertAppointment.startTime,
        endTime: insertAppointment.endTime,
        type: insertAppointment.type,
        location: insertAppointment.location ?? null,
        status: insertAppointment.status ?? "scheduled",
        appointmentStatus: insertAppointment.appointmentStatus ?? "pending",
      })
      .returning();
    return appointment;
  }

  async updateAppointment(id: number, updateData: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    // Convert string date to Date object if needed
    const processedData = { ...updateData } as any;
    if (processedData.date && typeof processedData.date === 'string') {
      processedData.date = new Date(processedData.date);
    }
    
    const [appointment] = await db
      .update(appointments)
      .set(processedData)
      .where(eq(appointments.id, id))
      .returning();
    return appointment || undefined;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    const result = await db.delete(appointments).where(eq(appointments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateUser(id: number, userData: Partial<InsertUser & { isOnline?: boolean; lastSeen?: Date }>): Promise<User | undefined> {
    // Hash password if provided
    if (userData.password) {
      const { hashPassword } = await import('./auth');
      userData.password = await hashPassword(userData.password);
    }

    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      // Delete related kanban tasks first
      await db.delete(kanbanTasks).where(eq(kanbanTasks.assignedToId, id));
      
      // Delete related kanban cards
      await db.delete(kanbanCards).where(eq(kanbanCards.assignedToId, id));
      
      // Delete related kanban boards
      await db.delete(kanbanBoards).where(eq(kanbanBoards.userId, id));
      
      // Delete related appointments
      await db.delete(appointments).where(eq(appointments.userId, id));
      
      // Delete related documents
      await db.delete(documents).where(eq(documents.userId, id));
      
      // Delete clients created by this user
      await db.delete(clients).where(eq(clients.userId, id));
      
      // Delete team member record
      await db.delete(teamMembers).where(eq(teamMembers.userId, id));
      
      // Delete the user
      const result = await db.delete(users).where(eq(users.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Stats methods
  async getStats(userId?: number, userRole?: string): Promise<{
    totalClients: number;
    activeProjects: number;
    upcomingMeetings: number;
    revenue: number;
  }> {
    let clientQuery, appointmentQuery;
    
    if (userRole === 'advisor' && userId) {
      // Advisors see only their own clients and appointments
      clientQuery = db.select().from(clients).where(eq(clients.userId, userId));
      appointmentQuery = db.select({
        id: appointments.id,
        title: appointments.title,
        description: appointments.description,
        clientId: appointments.clientId,
        userId: appointments.userId,
        assignedToId: appointments.assignedToId,
        date: appointments.date,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        type: appointments.type,
        location: appointments.location,
        status: appointments.status,
        appointmentStatus: appointments.appointmentStatus,
        createdAt: appointments.createdAt,
      }).from(appointments)
        .innerJoin(clients, eq(appointments.clientId, clients.id))
        .where(eq(clients.userId, userId));
    } else if (userRole === 'admin' || userRole === 'super_admin') {
      // Admin and super admin see all data
      clientQuery = db.select().from(clients);
      appointmentQuery = db.select().from(appointments);
    } else {
      // Default: see all data (backward compatibility)
      clientQuery = db.select().from(clients);
      appointmentQuery = db.select().from(appointments);
    }
    
    const [clientResults, appointmentResults] = await Promise.all([
      clientQuery,
      appointmentQuery
    ]);
    
    const now = new Date();
    const upcomingMeetings = appointmentResults.filter(apt => 
      new Date(apt.date) > now && apt.status === 'scheduled'
    ).length;

    const totalRevenue = clientResults.reduce((sum, client) => sum + (client.value || 0), 0);
    const activeProjects = clientResults.filter(client => client.status === 'active').length;

    return {
      totalClients: clientResults.length,
      activeProjects,
      upcomingMeetings,
      revenue: totalRevenue,
    };
  }

  // Kanban Board methods
  async getKanbanBoards(userId?: number): Promise<KanbanBoard[]> {
    if (userId) {
      return await db.select().from(kanbanBoards).where(eq(kanbanBoards.userId, userId));
    }
    return await db.select().from(kanbanBoards);
  }

  async getKanbanBoard(id: number): Promise<KanbanBoard | undefined> {
    const [board] = await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, id));
    return board || undefined;
  }

  async createKanbanBoard(insertBoard: InsertKanbanBoard): Promise<KanbanBoard> {
    const [board] = await db
      .insert(kanbanBoards)
      .values(insertBoard)
      .returning();
    return board;
  }

  async updateKanbanBoard(id: number, updateData: Partial<InsertKanbanBoard>): Promise<KanbanBoard | undefined> {
    const [board] = await db
      .update(kanbanBoards)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(kanbanBoards.id, id))
      .returning();
    return board || undefined;
  }

  async deleteKanbanBoard(id: number): Promise<boolean> {
    const result = await db.delete(kanbanBoards).where(eq(kanbanBoards.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Kanban Column methods
  async getKanbanColumns(boardId: number): Promise<KanbanColumn[]> {
    if (!boardId || isNaN(boardId)) {
      console.warn("Invalid boardId provided to getKanbanColumns:", boardId);
      return [];
    }
    return await db.select().from(kanbanColumns).where(eq(kanbanColumns.boardId, boardId));
  }

  async createKanbanColumn(insertColumn: InsertKanbanColumn): Promise<KanbanColumn> {
    const [column] = await db
      .insert(kanbanColumns)
      .values(insertColumn)
      .returning();
    return column;
  }

  async updateKanbanColumn(id: number, updateData: Partial<InsertKanbanColumn>): Promise<KanbanColumn | undefined> {
    const [column] = await db
      .update(kanbanColumns)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(kanbanColumns.id, id))
      .returning();
    return column || undefined;
  }

  async deleteKanbanColumn(id: number): Promise<boolean> {
    const result = await db.delete(kanbanColumns).where(eq(kanbanColumns.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Kanban Card methods
  async getKanbanCards(columnId: number): Promise<KanbanCard[]> {
    return await db.select().from(kanbanCards).where(eq(kanbanCards.columnId, columnId));
  }

  async getKanbanCard(id: number): Promise<KanbanCard | undefined> {
    const [card] = await db.select().from(kanbanCards).where(eq(kanbanCards.id, id));
    return card || undefined;
  }

  async createKanbanCard(insertCard: InsertKanbanCard): Promise<KanbanCard> {
    const [card] = await db
      .insert(kanbanCards)
      .values(insertCard)
      .returning();
    return card;
  }

  async updateKanbanCard(id: number, updateData: Partial<InsertKanbanCard>): Promise<KanbanCard | undefined> {
    const [card] = await db
      .update(kanbanCards)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(kanbanCards.id, id))
      .returning();
    return card || undefined;
  }

  async deleteKanbanCard(id: number): Promise<boolean> {
    const result = await db.delete(kanbanCards).where(eq(kanbanCards.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async moveKanbanCard(cardId: number, newColumnId: number, newPosition: number): Promise<KanbanCard | undefined> {
    const [card] = await db
      .update(kanbanCards)
      .set({ 
        columnId: newColumnId, 
        position: newPosition,
        updatedAt: new Date()
      })
      .where(eq(kanbanCards.id, cardId))
      .returning();
    return card || undefined;
  }

  // Task methods
  async getKanbanTasks(cardId: number): Promise<KanbanTask[]> {
    return await db.select().from(kanbanTasks).where(eq(kanbanTasks.cardId, cardId));
  }

  async getKanbanTask(id: number): Promise<KanbanTask | undefined> {
    const [task] = await db.select().from(kanbanTasks).where(eq(kanbanTasks.id, id));
    return task || undefined;
  }

  async createKanbanTask(insertTask: InsertKanbanTask): Promise<KanbanTask> {
    const [task] = await db
      .insert(kanbanTasks)
      .values({
        title: insertTask.title,
        description: insertTask.description ?? null,
        completed: insertTask.completed ?? false,
        position: insertTask.position ?? 0,
        cardId: insertTask.cardId,
        assignedToId: insertTask.assignedToId ?? null,
      })
      .returning();
    return task;
  }

  async updateKanbanTask(id: number, updateData: Partial<InsertKanbanTask>): Promise<KanbanTask | undefined> {
    const [task] = await db
      .update(kanbanTasks)
      .set(updateData)
      .where(eq(kanbanTasks.id, id))
      .returning();
    return task || undefined;
  }

  async getCdnQuotations(clientId: number): Promise<CdnQuotation[]> {
    return await db.select().from(cdnQuotations).where(eq(cdnQuotations.clientId, clientId));
  }

  async createCdnQuotation(insertQuotation: InsertCdnQuotation): Promise<CdnQuotation> {
    const [quotation] = await db
      .insert(cdnQuotations)
      .values({
        ...insertQuotation,
        commencementDate: insertQuotation.commencementDate ? new Date(insertQuotation.commencementDate as any) : new Date(),
        redemptionDate: insertQuotation.redemptionDate ? new Date(insertQuotation.redemptionDate as any) : new Date(),
      } as any)
      .returning();
    return quotation;
  }

  async getCdnQuotation(id: number): Promise<CdnQuotation | undefined> {
    const [quotation] = await db.select().from(cdnQuotations).where(eq(cdnQuotations.id, id));
    return quotation || undefined;
  }
}

export const storage = new DatabaseStorage();
