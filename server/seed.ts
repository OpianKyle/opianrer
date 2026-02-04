import { db } from './db';
import { clients, appointments, users } from '@shared/schema';
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function seedDatabase() {
  console.log('Seeding database with sample data...');
  
  try {
    // Check if data already exists
    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) {
      console.log('Database already contains data, skipping seed');
      return;
    }

    // Create demo users with different roles
    const demoUsers = [
      {
        username: "demo",
        email: "demo@crmhub.com",
        password: await hashPassword("demo123"),
        firstName: "Demo",
        lastName: "User",
        role: "admin",
      },
      {
        username: "advisor",
        email: "advisor@crmhub.com",
        password: await hashPassword("advisor123"),
        firstName: "John",
        lastName: "Advisor",
        role: "advisor",
      },
      {
        username: "super_admin",
        email: "super@crmhub.com",
        password: await hashPassword("super123"),
        firstName: "Super",
        lastName: "Admin",
        role: "super_admin",
      },
    ];

    const insertedUsers = await db.insert(users).values(demoUsers).returning();
    console.log(`Created ${insertedUsers.length} demo users`);
    
    const adminUserId = insertedUsers[0].id;
    const advisorUserId = insertedUsers[1].id;

    // Sample clients for different users
    const sampleClients = [
      {
        firstName: "Sarah",
        surname: "Johnson",
        email: "sarah.johnson@techcorp.com",
        cellPhone: "+1 (555) 123-4567",
        status: "active",
        value: 75000,
        userId: adminUserId,
      },
      {
        firstName: "Michael",
        surname: "Chen",
        email: "m.chen@innovatelab.com",
        cellPhone: "+1 (555) 987-6543",
        status: "prospect",
        value: 45000,
        userId: adminUserId,
      },
      {
        firstName: "Emily",
        surname: "Rodriguez",
        email: "emily.r@digitalwave.com",
        cellPhone: "+1 (555) 456-7890",
        status: "active",
        value: 120000,
        userId: advisorUserId,
      },
      {
        firstName: "David",
        surname: "Wilson",
        email: "david.wilson@startup.com",
        cellPhone: "+1 (555) 111-2222",
        status: "active",
        value: 85000,
        userId: advisorUserId,
      },
    ];

    // Insert clients
    const insertedClients = await db.insert(clients).values(sampleClients).returning();
    console.log(`Inserted ${insertedClients.length} clients`);

    // Sample appointments
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const sampleAppointments = [
      {
        title: "Product Demo Meeting",
        description: "Showcase our latest features and discuss integration options",
        clientId: insertedClients[0].id,
        userId: adminUserId,
        date: tomorrow,
        startTime: "10:00",
        endTime: "11:00",
        type: "meeting",
        location: "Conference Room A",
        status: "scheduled",
      },
      {
        title: "Weekly Check-in Call",
        description: "Regular project update and planning session",
        clientId: insertedClients[1].id,
        userId: adminUserId,
        date: today,
        startTime: "14:30",
        endTime: "15:00",
        type: "call",
        location: "",
        status: "scheduled",
      },
      {
        title: "Contract Review",
        description: "Review and finalize the service agreement",
        clientId: insertedClients[2].id,
        userId: advisorUserId,
        date: nextWeek,
        startTime: "09:00",
        endTime: "10:30",
        type: "review",
        location: "Client Office",
        status: "scheduled",
      },
      {
        title: "Follow-up Meeting",
        description: "Discuss next steps and project timeline",
        clientId: insertedClients[3].id,
        userId: advisorUserId,
        date: tomorrow,
        startTime: "15:00",
        endTime: "16:00",
        type: "meeting",
        location: "Video Call",
        status: "scheduled",
      },
    ];

    // Insert appointments
    const insertedAppointments = await db.insert(appointments).values(sampleAppointments).returning();
    console.log(`Inserted ${insertedAppointments.length} appointments`);

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}