import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { clients } from "./schema";

// Separate table for client dependents since they can have multiple dependents
export const clientDependents = pgTable("client_dependents", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  name: text("name").notNull(),
  surname: text("surname").notNull(),
  dateOfBirth: timestamp("date_of_birth"),
  gender: text("gender"), // Male, Female
  relationship: text("relationship"), // Child, Dependent, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Separate table for monthly expenditure as it has many categories
export const clientMonthlyExpenditure = pgTable("client_monthly_expenditure", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  
  // Housing & Utilities
  rentBond: integer("rent_bond"),
  ratesTaxesLevies: integer("rates_taxes_levies"),
  electricity: integer("electricity"),
  security: integer("security"),
  housekeeperGardener: integer("housekeeper_gardener"),
  repairsMaintenance: integer("repairs_maintenance"),
  
  // Living Expenses
  groceries: integer("groceries"),
  dstv: integer("dstv"),
  clothing: integer("clothing"),
  entertainment: integer("entertainment"),
  phones: integer("phones"),
  
  // Transportation
  carPaymentsFuel: integer("car_payments_fuel"),
  
  // Insurance & Financial
  shortLongTermInsurance: integer("short_long_term_insurance"),
  
  // Family & Education
  schoolFees: integer("school_fees"),
  
  // Personal
  hobbies: integer("hobbies"),
  donationsCharity: integer("donations_charity"),
  
  // Other
  other1: integer("other1"),
  other1Description: text("other1_description"),
  other2: integer("other2"),
  other2Description: text("other2_description"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Special financial goals table
export const clientSpecialGoals = pgTable("client_special_goals", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  details: text("details").notNull(),
  year: integer("year"),
  amount: integer("amount"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ClientDependent = typeof clientDependents.$inferSelect;
export type InsertClientDependent = typeof clientDependents.$inferInsert;
export type ClientMonthlyExpenditure = typeof clientMonthlyExpenditure.$inferSelect;
export type InsertClientMonthlyExpenditure = typeof clientMonthlyExpenditure.$inferInsert;
export type ClientSpecialGoal = typeof clientSpecialGoals.$inferSelect;
export type InsertClientSpecialGoal = typeof clientSpecialGoals.$inferInsert;