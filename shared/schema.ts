import { pgTable, text, serial, integer, boolean, timestamp, varchar, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  
  // Personal Information
  title: text("title"), // Mr, Mrs, Dr, etc.
  firstName: text("first_name").notNull(),
  surname: text("surname").notNull(),
  secondName: text("second_name"),
  idNumber: text("id_number"),
  dateOfBirth: timestamp("date_of_birth"),
  smokerStatus: boolean("smoker_status").default(false),
  
  // Contact Details
  cellPhone: text("cell_phone"),
  homePhone: text("home_phone"),
  workPhone: text("work_phone"),
  email: text("email").unique(),
  physicalAddress: text("physical_address"),
  postalAddress: text("postal_address"),
  physicalPostalCode: text("physical_postal_code"),
  postalCode: text("postal_code"),
  
  // Employment & Education
  occupation: text("occupation"),
  employer: text("employer"),
  educationLevel: text("education_level"),
  grossAnnualIncome: integer("gross_annual_income"),
  dutySplitAdmin: integer("duty_split_admin"), // percentage
  dutySplitTravel: integer("duty_split_travel"), // percentage
  dutySplitSupervision: integer("duty_split_supervision"), // percentage
  dutySplitManual: integer("duty_split_manual"), // percentage
  hobbies: text("hobbies"),
  
  // Marital Details
  maritalStatus: text("marital_status"), // Married, Single, Divorced, Widowed
  marriageType: text("marriage_type"), // ANC, Accrual, COP
  dateOfMarriage: timestamp("date_of_marriage"),
  spouseName: text("spouse_name"),
  spouseMaidenName: text("spouse_maiden_name"),
  spouseDateOfBirth: timestamp("spouse_date_of_birth"),
  spouseSmokerStatus: boolean("spouse_smoker_status"),
  spouseOccupation: text("spouse_occupation"),
  spouseEmployer: text("spouse_employer"),
  spouseEducationLevel: text("spouse_education_level"),
  spouseGrossAnnualIncome: integer("spouse_gross_annual_income"),
  spouseDutySplitAdmin: integer("spouse_duty_split_admin"),
  spouseDutySplitTravel: integer("spouse_duty_split_travel"),
  spouseDutySplitSupervision: integer("spouse_duty_split_supervision"),
  spouseDutySplitManual: integer("spouse_duty_split_manual"),
  
  // Financial Information
  monthlyIncome: integer("monthly_income"),
  spouseMonthlyIncome: integer("spouse_monthly_income"),
  
  // Group Risk Benefits
  pensionFundCurrentValue: integer("pension_fund_current_value"),
  pensionFundProjectedValue: integer("pension_fund_projected_value"),
  providentFundCurrentValue: integer("provident_fund_current_value"),
  providentFundProjectedValue: integer("provident_fund_projected_value"),
  groupLifeCover: integer("group_life_cover"),
  groupDisabilityCover: integer("group_disability_cover"),
  groupDreadDiseaseCover: integer("group_dread_disease_cover"),
  disabilityIncomeCover: integer("disability_income_cover"),
  
  // Medical Aid
  medicalAidScheme: text("medical_aid_scheme"),
  medicalAidMembershipNo: text("medical_aid_membership_no"),
  medicalAidMembers: integer("medical_aid_members"),
  medicalAidCompulsory: boolean("medical_aid_compulsory"),
  medicalAidSatisfied: boolean("medical_aid_satisfied"),
  
  // Financial Objectives
  deathMonthlyIncome: integer("death_monthly_income"),
  disabilityCapitalExpenses: integer("disability_capital_expenses"),
  disabilityMonthlyIncome: integer("disability_monthly_income"),
  dreadDiseaseCover: integer("dread_disease_cover"),
  retirementAge: integer("retirement_age"),
  retirementMonthlyIncome: integer("retirement_monthly_income"),
  childrenEducationAmount: integer("children_education_amount"),
  childrenEducationYear: integer("children_education_year"),
  
  // Investment Expectations
  expectedInvestmentReturns: integer("expected_investment_returns"), // percentage
  expectedInflation: integer("expected_inflation"), // percentage
  
  // Will Information
  hasWill: boolean("has_will"),
  willLocation: text("will_location"),
  willLastUpdated: timestamp("will_last_updated"),
  willExecutor: text("will_executor"),
  
  // CRM Fields
  status: text("status").notNull().default("active"), // active, prospect, inactive
  value: integer("value").default(0),
  lastContact: timestamp("last_contact").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  userId: integer("user_id").references(() => users.id),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  originalName: text("original_name").notNull(),
  size: integer("size").notNull(),
  type: text("type").notNull(),
  clientId: integer("client_id").references(() => clients.id),
  userId: integer("user_id").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  role: text("role").default("user"), // super_admin, admin, advisor, user
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("Admin"), // CEO, Financial Advisor, Admin, IT
  department: text("department"),
  isActive: boolean("is_active").default(true),
  userId: integer("user_id").references(() => users.id),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  clientId: integer("client_id").references(() => clients.id),
  userId: integer("user_id").references(() => users.id), // Who created the appointment
  assignedToId: integer("assigned_to_id").references(() => users.id), // Who the appointment is assigned to
  date: timestamp("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  type: text("type").notNull(), // meeting, call, review
  location: text("location"),
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled
  appointmentStatus: text("appointment_status").notNull().default("pending"), // pending, scheduled, completed, cancelled, no_show
  createdAt: timestamp("created_at").defaultNow(),
});

export const kanbanBoards = pgTable("kanban_boards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const kanbanColumns = pgTable("kanban_columns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  color: varchar("color", { length: 7 }).default("#0073EA"),
  boardId: integer("board_id").references(() => kanbanBoards.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const kanbanCards = pgTable("kanban_cards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  priority: text("priority").default("medium"), // low, medium, high, urgent
  dueDate: date("due_date"),
  tags: text("tags").array(),
  columnId: integer("column_id").references(() => kanbanColumns.id, { onDelete: "cascade" }),
  assignedToId: integer("assigned_to_id").references(() => users.id),
  clientId: integer("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const kanbanTasks = pgTable("kanban_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  completed: boolean("completed").default(false),
  position: integer("position").notNull().default(0),
  cardId: integer("card_id").references(() => kanbanCards.id, { onDelete: "cascade" }),
  assignedToId: integer("assigned_to_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  lastContact: true,
  userId: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  surname: z.string().min(1, "Surname is required"),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  // Make numeric fields coercible and optional
  grossAnnualIncome: z.coerce.number().optional(),
  monthlyIncome: z.coerce.number().optional(),
  spouseGrossAnnualIncome: z.coerce.number().optional(),
  spouseMonthlyIncome: z.coerce.number().optional(),
  pensionFundCurrentValue: z.coerce.number().optional(),
  pensionFundProjectedValue: z.coerce.number().optional(),
  providentFundCurrentValue: z.coerce.number().optional(),
  providentFundProjectedValue: z.coerce.number().optional(),
  groupLifeCover: z.coerce.number().optional(),
  groupDisabilityCover: z.coerce.number().optional(),
  groupDreadDiseaseCover: z.coerce.number().optional(),
  disabilityIncomeCover: z.coerce.number().optional(),
  medicalAidMembers: z.coerce.number().optional(),
  deathMonthlyIncome: z.coerce.number().optional(),
  disabilityCapitalExpenses: z.coerce.number().optional(),
  disabilityMonthlyIncome: z.coerce.number().optional(),
  dreadDiseaseCover: z.coerce.number().optional(),
  retirementAge: z.coerce.number().optional(),
  retirementMonthlyIncome: z.coerce.number().optional(),
  childrenEducationAmount: z.coerce.number().optional(),
  childrenEducationYear: z.coerce.number().optional(),
  expectedInvestmentReturns: z.coerce.number().optional(),
  expectedInflation: z.coerce.number().optional(),
  value: z.coerce.number().optional(),
  // Make percentage fields that must be between 0-100
  dutySplitAdmin: z.coerce.number().min(0).max(100).optional(),
  dutySplitTravel: z.coerce.number().min(0).max(100).optional(),
  dutySplitSupervision: z.coerce.number().min(0).max(100).optional(),
  dutySplitManual: z.coerce.number().min(0).max(100).optional(),
  spouseDutySplitAdmin: z.coerce.number().min(0).max(100).optional(),
  spouseDutySplitTravel: z.coerce.number().min(0).max(100).optional(),
  spouseDutySplitSupervision: z.coerce.number().min(0).max(100).optional(),
  spouseDutySplitManual: z.coerce.number().min(0).max(100).optional(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
}).extend({
  date: z.string().min(1, "Date is required"),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertKanbanBoardSchema = createInsertSchema(kanbanBoards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
});

export const insertKanbanColumnSchema = createInsertSchema(kanbanColumns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKanbanCardSchema = createInsertSchema(kanbanCards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const cdnQuotations = pgTable("cdn_quotations", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  clientNumber: text("client_number").notNull().default(""),
  clientName: text("client_name").notNull().default(""),
  clientAddress: text("client_address").notNull().default(""),
  clientPhone: text("client_phone"),
  offeredTo: text("offered_to"),
  investmentAmount: integer("investment_amount").notNull(),
  term: integer("term").notNull().default(1), // Years
  interestRate: text("interest_rate").notNull(),
  yearlyDivAllocation: integer("yearly_div_allocation").notNull().default(975),
  maturityValue: integer("maturity_value").notNull(),
  calculationDate: timestamp("calculation_date").notNull().defaultNow(),
  commencementDate: timestamp("commencement_date").notNull().defaultNow(),
  redemptionDate: timestamp("redemption_date").notNull().defaultNow(),
  preparedByName: text("prepared_by_name"),
  preparedByCell: text("prepared_by_cell"),
  preparedByOffice: text("prepared_by_office"),
  preparedByEmail: text("prepared_by_email"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  userId: integer("user_id").references(() => users.id),
});

export const interestRates = pgTable("interest_rates", {
  id: serial("id").primaryKey(),
  term: integer("term").notNull(),
  rate: text("rate").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInterestRateSchema = createInsertSchema(interestRates).omit({
  id: true,
  updatedAt: true,
});

export type InterestRate = typeof interestRates.$inferSelect;
export type InsertInterestRate = z.infer<typeof insertInterestRateSchema>;

export const insertCdnQuotationSchema = createInsertSchema(cdnQuotations).omit({
  id: true,
  createdAt: true,
  userId: true,
}).extend({
  investmentAmount: z.coerce.number().min(1, "Investment amount is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  yearlyDivAllocation: z.coerce.number().optional().default(9.75),
  maturityValue: z.coerce.number().optional(),
  calculationDate: z.coerce.date().optional(),
  commencementDate: z.coerce.date().optional(),
  redemptionDate: z.coerce.date().optional(),
  term: z.coerce.number().min(1, "Term is required"),
});

export type InsertCdnQuotation = z.infer<typeof insertCdnQuotationSchema>;
export type CdnQuotation = typeof cdnQuotations.$inferSelect;

export const insertKanbanTaskSchema = createInsertSchema(kanbanTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  clients: many(clients),
  documents: many(documents),
  appointments: many(appointments),
  teamMembers: many(teamMembers),
  cdnQuotations: many(cdnQuotations),
}));

export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  assignedAppointments: many(appointments),
}));

export const clientsRelations = relations(clients, ({ many, one }) => ({
  documents: many(documents),
  appointments: many(appointments),
  cdnQuotations: many(cdnQuotations),
  user: one(users, {
    fields: [clients.userId],
    references: [users.id],
  }),
}));

export const cdnQuotationsRelations = relations(cdnQuotations, ({ one }) => ({
  client: one(clients, {
    fields: [cdnQuotations.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [cdnQuotations.userId],
    references: [users.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  client: one(clients, {
    fields: [documents.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  client: one(clients, {
    fields: [appointments.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [appointments.userId],
    references: [users.id],
  }),
  assignedTo: one(teamMembers, {
    fields: [appointments.assignedToId],
    references: [teamMembers.id],
  }),
}));

export const kanbanBoardsRelations = relations(kanbanBoards, ({ one, many }) => ({
  user: one(users, {
    fields: [kanbanBoards.userId],
    references: [users.id],
  }),
  columns: many(kanbanColumns),
}));

export const kanbanColumnsRelations = relations(kanbanColumns, ({ one, many }) => ({
  board: one(kanbanBoards, {
    fields: [kanbanColumns.boardId],
    references: [kanbanBoards.id],
  }),
  cards: many(kanbanCards),
}));

export const kanbanCardsRelations = relations(kanbanCards, ({ one, many }) => ({
  column: one(kanbanColumns, {
    fields: [kanbanCards.columnId],
    references: [kanbanColumns.id],
  }),
  assignedTo: one(users, {
    fields: [kanbanCards.assignedToId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [kanbanCards.clientId],
    references: [clients.id],
  }),
  tasks: many(kanbanTasks),
}));

export const kanbanTasksRelations = relations(kanbanTasks, ({ one }) => ({
  card: one(kanbanCards, {
    fields: [kanbanTasks.cardId],
    references: [kanbanCards.id],
  }),
  assignedTo: one(users, {
    fields: [kanbanTasks.assignedToId],
    references: [users.id],
  }),
}));

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertKanbanBoard = z.infer<typeof insertKanbanBoardSchema>;
export type KanbanBoard = typeof kanbanBoards.$inferSelect;
export type InsertKanbanColumn = z.infer<typeof insertKanbanColumnSchema>;
export type KanbanColumn = typeof kanbanColumns.$inferSelect;
export type InsertKanbanCard = z.infer<typeof insertKanbanCardSchema>;
export type KanbanCard = typeof kanbanCards.$inferSelect;
export type InsertKanbanTask = z.infer<typeof insertKanbanTaskSchema>;
export type KanbanTask = typeof kanbanTasks.$inferSelect;
