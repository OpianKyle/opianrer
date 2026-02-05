import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { insertClientSchema, insertDocumentSchema, insertAppointmentSchema, insertTeamMemberSchema, insertKanbanTaskSchema, insertCdnQuotationSchema, cdnQuotations } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { setupAuth, requireAuth } from "./auth";
import { sendAppointmentConfirmation, sendAppointmentUpdate, sendCdnQuotationEmail } from "./email";
import { format } from "date-fns";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({ 
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Helper function to check if user has admin privileges
function hasAdminAccess(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'super_admin';
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Serve static files from uploads directory
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Client routes
  app.get("/api/clients", requireAuth, async (req: any, res) => {
    try {
      // Pass user role to storage layer for role-based filtering
      const clients = await storage.getClients(req.user.id, req.user.role);
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", requireAuth, async (req: any, res) => {
    try {
      console.log("Creating client with data:", req.body);
      const result = insertClientSchema.safeParse(req.body);
      if (!result.success) {
        console.log("Validation errors:", result.error.issues);
        return res.status(400).json({ message: "Invalid client data", errors: result.error.issues });
      }
      const clientData = { ...result.data, userId: req.user.id };
      console.log("Processed client data:", clientData);
      const client = await storage.createClient(clientData);
      
      // Send notification for new client creation
      wss.clients.forEach((wsClient: WebSocket) => {
        if (wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify({
            type: 'notification',
            data: {
              id: `client_created_${client.id}`,
              title: 'New Client Added',
              body: `${clientData.firstName} ${clientData.surname} has been added to your client list`,
              timestamp: Date.now(),
              type: 'client',
              read: false,
              url: `/clients`,
              requirePush: true,
              createdBy: req.user.username
            }
          }));
        }
      });
      
      res.status(201).json(client);
    } catch (error: any) {
      console.error("Client creation error:", error);
      res.status(500).json({ message: "Failed to create client", error: error.message });
    }
  });

  app.put("/api/clients/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("Updating client with ID:", id);
      console.log("Update data received:", req.body);
      
      const result = insertClientSchema.partial().safeParse(req.body);
      if (!result.success) {
        console.log("Validation errors:", result.error.issues);
        return res.status(400).json({ message: "Invalid client data", errors: result.error.issues });
      }
      
      console.log("Validated data:", result.data);
      const client = await storage.updateClient(id, result.data);
      if (!client) {
        console.log("Client not found with ID:", id);
        return res.status(404).json({ message: "Client not found" });
      }
      
      console.log("Client updated successfully:", client);
      res.json(client);
    } catch (error: any) {
      console.error("Client update error:", error);
      res.status(500).json({ message: "Failed to update client", error: error.message });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteClient(id);
      if (!success) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Document routes
  app.get("/api/documents", requireAuth, async (req: any, res) => {
    try {
      // Admin and super admin can see all documents, regular users see only their own
      const userId = hasAdminAccess(req.user.role) ? undefined : req.user.id;
      const documents = await storage.getDocuments(userId, req.user.role);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/client/:clientId", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const documents = await storage.getDocumentsByClient(clientId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", requireAuth, upload.single("file"), async (req: MulterRequest & any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const clientId = req.body.clientId ? parseInt(req.body.clientId) : null;
      
      const documentData = {
        name: req.file.filename || req.file.originalname,
        originalName: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        clientId,
        userId: req.user.id,
      };

      const result = insertDocumentSchema.safeParse(documentData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid document data", errors: result.error.issues });
      }

      const document = await storage.createDocument(result.data);
      res.status(201).json(document);
    } catch (error) {
      console.error("Document upload error:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.get("/api/documents/:id/download", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const filePath = path.join(process.cwd(), "uploads", document.name);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }
      
      res.download(filePath, document.originalName);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteDocument(id);
      if (!success) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Profile picture routes
  app.post("/api/profile-picture", requireAuth, upload.single("file"), async (req: MulterRequest & any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Check if file is an image
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "Only image files are allowed" });
      }

      const imageUrl = `/uploads/${req.file.filename}`;
      
      // Update user profile with image URL
      const updatedUser = await storage.updateUser(req.user.id, {
        profileImageUrl: imageUrl
      });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ 
        imageUrl,
        message: "Profile picture updated successfully" 
      });
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      res.status(500).json({ error: "Failed to upload profile picture" });
    }
  });

  app.delete("/api/profile-picture/:userId", requireAuth, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Check if user can delete this profile picture
      if (req.user.id !== userId && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const updatedUser = await storage.updateUser(userId, {
        profileImageUrl: null
      });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "Profile picture deleted successfully" });
    } catch (error) {
      console.error("Error deleting profile picture:", error);
      res.status(500).json({ error: "Failed to delete profile picture" });
    }
  });

  // Appointment routes
  app.get("/api/appointments", requireAuth, async (req: any, res) => {
    try {
      // Pass user role to storage layer for role-based filtering
      const appointments = await storage.getAppointments(req.user.id, req.user.role);
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/client/:clientId", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const appointments = await storage.getAppointmentsByClient(clientId);
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments", requireAuth, async (req: any, res) => {
    try {
      const result = insertAppointmentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid appointment data", errors: result.error.issues });
      }
      const appointmentData = { ...result.data, userId: req.user.id };
      const appointment = await storage.createAppointment(appointmentData);
      
      // Send notification to assigned user if different from creator
      if (appointment.assignedToId && appointment.assignedToId !== req.user.id) {
        const assignedUser = await storage.getUser(appointment.assignedToId);
        if (assignedUser) {
          // Broadcast appointment notification via WebSocket with push notification flag
          wss.clients.forEach((client: WebSocket) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'notification',
                data: {
                  id: `appointment_${appointment.id}`,
                  title: 'New Appointment Assigned',
                  body: `You have been assigned to: ${appointment.title}`,
                  timestamp: Date.now(),
                  type: 'appointment',
                  read: false,
                  url: `/appointments`,
                  requirePush: true, // Flag to trigger push notification
                  appointmentId: appointment.id,
                  assignedToId: appointment.assignedToId,
                  createdBy: req.user.username
                }
              }));
            }
          });
        }
      }

      // Send email notifications
      try {
        const client = await storage.getClient(appointment.clientId);
        const assignedUser = appointment.assignedToId ? await storage.getUser(appointment.assignedToId) : null;
        
        if (client && assignedUser) {
          const appointmentDate = format(new Date(appointment.date), 'MMMM d, yyyy');
          const appointmentTime = `${appointment.startTime} - ${appointment.endTime}`;
          
          await sendAppointmentConfirmation({
            clientName: `${client.firstName} ${client.surname}`,
            clientEmail: client.email,
            appointmentTitle: appointment.title,
            appointmentDate,
            appointmentTime,
            teamMemberName: assignedUser.firstName || assignedUser.username,
            teamMemberEmail: assignedUser.email,
            description: appointment.description || undefined
          });
        }
      } catch (emailError) {
        console.error('Failed to send appointment confirmation emails:', emailError);
        // Don't fail the request if email fails
      }
      
      res.status(201).json(appointment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.put("/api/appointments/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertAppointmentSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid appointment data", errors: result.error.issues });
      }
      const appointment = await storage.updateAppointment(id, result.data);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      // Send email notifications for update
      try {
        const client = await storage.getClient(appointment.clientId);
        const assignedUser = appointment.assignedToId ? await storage.getUser(appointment.assignedToId) : null;
        
        if (client && assignedUser) {
          const appointmentDate = format(new Date(appointment.date), 'MMMM d, yyyy');
          const appointmentTime = `${appointment.startTime} - ${appointment.endTime}`;
          
          await sendAppointmentUpdate({
            clientName: `${client.firstName} ${client.surname}`,
            clientEmail: client.email,
            appointmentTitle: appointment.title,
            appointmentDate,
            appointmentTime,
            teamMemberName: assignedUser.firstName || assignedUser.username,
            teamMemberEmail: assignedUser.email,
            description: appointment.description || undefined,
            isUpdate: true
          });
        }
      } catch (emailError) {
        console.error('Failed to send appointment update emails:', emailError);
        // Don't fail the request if email fails
      }

      res.json(appointment);
    } catch (error) {
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get appointment details before deletion for email notification
      const appointmentToDelete = await storage.getAppointment(id);
      
      const success = await storage.deleteAppointment(id);
      if (!success) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      // Send email notifications for cancellation
      if (appointmentToDelete) {
        try {
          const client = await storage.getClient(appointmentToDelete.clientId);
          const assignedUser = appointmentToDelete.assignedToId ? await storage.getUser(appointmentToDelete.assignedToId) : null;
          
          if (client && assignedUser) {
            const appointmentDate = format(new Date(appointmentToDelete.date), 'MMMM d, yyyy');
            const appointmentTime = `${appointmentToDelete.startTime} - ${appointmentToDelete.endTime}`;
            
            await sendAppointmentUpdate({
              clientName: `${client.firstName} ${client.surname}`,
              clientEmail: client.email,
              appointmentTitle: appointmentToDelete.title,
              appointmentDate,
              appointmentTime,
              teamMemberName: assignedUser.firstName || assignedUser.username,
              teamMemberEmail: assignedUser.email,
              description: appointmentToDelete.description || undefined,
              isUpdate: false
            });
          }
        } catch (emailError) {
          console.error('Failed to send appointment cancellation emails:', emailError);
          // Don't fail the request if email fails
        }
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete appointment" });
    }
  });

  // Users endpoint (replaces team members)
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user (super admin only)
  app.put("/api/users/:id", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only super admins can edit users" });
      }

      const id = parseInt(req.params.id);
      const updateData = req.body;
      
      // Remove password from update if empty
      if (updateData.password === '') {
        delete updateData.password;
      }
      
      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user (super admin only)
  app.delete("/api/users/:id", requireAuth, async (req: any, res) => {
    try {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: "Only super admins can delete users" });
      }

      const id = parseInt(req.params.id);
      
      // Prevent deleting self
      if (id === req.user.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.get("/api/cdn-quotations/:id/download", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const quotation = await storage.getCdnQuotation(id);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      const client = await storage.getClient(quotation.clientId!);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const doc = await PDFDocument.create();
      const page = doc.addPage();
      const { width, height } = page.getSize();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

      page.drawText('CDN QUOTATION', { x: 50, y: height - 50, size: 20, font: boldFont });
      page.drawText(`Reference: ${quotation.clientNumber}`, { x: 50, y: height - 80, size: 12, font });
      page.drawText(`Date: ${format(new Date(quotation.calculationDate), 'yyyy-MM-dd')}`, { x: 50, y: height - 100, size: 12, font });

      page.drawText('Client Information', { x: 50, y: height - 140, size: 14, font: boldFont });
      page.drawText(`Name: ${quotation.clientName}`, { x: 50, y: height - 160, size: 12, font });
      page.drawText(`Address: ${quotation.clientAddress}`, { x: 50, y: height - 180, size: 12, font });

      page.drawText('Quotation Details', { x: 50, y: height - 220, size: 14, font: boldFont });
      page.drawText(`Investment Amount: R ${quotation.investmentAmount.toLocaleString()}`, { x: 50, y: height - 240, size: 12, font });
      page.drawText(`Interest Rate: ${quotation.interestRate}`, { x: 50, y: height - 260, size: 12, font });
      page.drawText(`Term: ${quotation.term} Years`, { x: 50, y: height - 280, size: 12, font });
      page.drawText(`Maturity Value: R ${quotation.maturityValue.toLocaleString()}`, { x: 50, y: height - 300, size: 12, font });

      const pdfBytes = await doc.save();
      const fileName = `Quotation_${quotation.clientNumber || id}.pdf`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, pdfBytes);

      // Save as document record
      await storage.createDocument({
        name: fileName,
        originalName: fileName,
        size: pdfBytes.length,
        type: 'application/pdf',
        clientId: quotation.clientId,
        userId: req.user.id,
      });

      res.contentType("application/pdf");
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error("PDF Generation error:", error);
      res.status(500).json({ message: "Failed to generate quotation PDF" });
    }
  });

  // Keep team-members endpoint for backward compatibility
  app.get("/api/team-members", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Stats route
  app.get("/api/stats", requireAuth, async (req: any, res) => {
    try {
      // Pass user role to storage layer for role-based filtering
      const stats = await storage.getStats(req.user.id, req.user.role);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // CDN Quotation routes
  app.get("/api/cdn-quotations/:clientId", requireAuth, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const quotations = await storage.getCdnQuotations(clientId);
      res.json(quotations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });

  app.post("/api/cdn-quotations", requireAuth, async (req: any, res) => {
    try {
      const result = insertCdnQuotationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid quotation data", errors: result.error.issues });
      }
      const quotationData = { 
        ...result.data, 
        userId: req.user.id,
        calculationDate: result.data.calculationDate ? new Date(result.data.calculationDate) : undefined,
        commencementDate: result.data.commencementDate ? new Date(result.data.commencementDate) : undefined,
        redemptionDate: result.data.redemptionDate ? new Date(result.data.redemptionDate) : undefined,
        interestRate: result.data.interestRate.toString(), // Ensure it's a string
        maturityValue: Math.round(Number(result.data.maturityValue) || 0), // Ensure it's an integer for the DB
        investmentAmount: Math.round(Number(result.data.investmentAmount) || 0),
        yearlyDivAllocation: Math.round(Number(result.data.yearlyDivAllocation) || 975),
      };
      const quotation = await storage.createCdnQuotation(quotationData as any);
      res.status(201).json(quotation);
    } catch (error) {
      res.status(500).json({ message: "Failed to create quotation" });
    }
  });

  app.post("/api/cdn-quotations/:id/email", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const quotation = await db.select().from(cdnQuotations).where(eq(cdnQuotations.id, id)).limit(1).then(rows => rows[0]);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }

      const client = await storage.getClient(quotation.clientId!);
      if (!client || !client.email) {
        return res.status(400).json({ message: "Client or client email not found" });
      }

      await sendCdnQuotationEmail({
        clientName: `${client.firstName} ${client.surname}`,
        clientEmail: client.email,
        amount: quotation.investmentAmount,
        rate: quotation.interestRate,
        maturity: quotation.maturityValue
      });

      await db.update(cdnQuotations).set({ status: 'sent' }).where(eq(cdnQuotations.id, id));
      res.json({ message: "Email sent successfully" });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // Generate PDF from quotation
  app.post("/api/cdn-quotations/:id/pdf", requireAuth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const quotation = await db.select().from(cdnQuotations).where(eq(cdnQuotations.id, id)).limit(1).then(rows => rows[0]);

      if (!quotation) {
        return res.status(404).json({ error: "Quotation not found" });
      }

      // === PDF Setup ===
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const leftMargin = 72; // 1 inch margin
      const rightMargin = 72;
      const pageWidth = 595.28;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      // Load logo image
      let logoImage: any = null;
      try {
        const logoPath = path.join(__dirname, "../attached_assets/image_1756901569236_1770200770187.png");
        const logoBytes = await fs.promises.readFile(logoPath);
        logoImage = await pdfDoc.embedPng(logoBytes);
      } catch (error) {
        console.warn("Could not load logo image:", error);
      }


      // === Helper Functions ===
      const drawJustifiedText = (
        page: any,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        font: any,
        fontSize: number = 10,
        lineSpacing: number = 17 // 1.5 line spacing
      ) => {
        text = text.replace(/\s+/g, " ").trim();
        const words = text.split(" ");
        let lines: string[][] = [];
        let currentLine: string[] = [];

        words.forEach((word) => {
          const testLine = [...currentLine, word];
          const textWidth = font.widthOfTextAtSize(testLine.join(" "), fontSize);
          if (textWidth > maxWidth && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = [word];
          } else {
            currentLine = testLine;
          }
        });
        if (currentLine.length > 0) lines.push(currentLine);

        lines.forEach((lineWords, i) => {
          const lineText = lineWords.join(" ");
          const lineWidth = font.widthOfTextAtSize(lineText, fontSize);

          if (i === lines.length - 1 || lineWords.length === 1) {
            // Last line or single word - left align
            page.drawText(lineText, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
          } else {
            // Justify text by distributing extra space
            const extraSpace = (maxWidth - lineWidth) / (lineWords.length - 1);
            let cursorX = x;
            lineWords.forEach((word, wordIndex) => {
              page.drawText(word, { x: cursorX, y, size: fontSize, font, color: rgb(0, 0, 0) });
              if (wordIndex < lineWords.length - 1) {
                cursorX += font.widthOfTextAtSize(word, fontSize) + font.widthOfTextAtSize(" ", fontSize) + extraSpace;
              }
            });
          }
          y -= lineSpacing;
        });

        return y;
      };

      const addFooter = (page: any) => {
        const footerY = 50;
        const footerText = [
          "Opian Capital (Pty) Ltd is Licensed as a Juristic Representative with FSP No: 50974",
          "Company Registration Number: 2022/272376/07 FSP No: 50974", 
          "Company Address: 260 Uys Krige Drive, Loevenstein, Bellville, 7530, Western Cape",
          "Tel: 0861 263 346 | Email: info@opianfsgroup.com | Website: www.opianfsgroup.com"
        ];
        
        footerText.forEach((line, i) => {
          const textWidth = font.widthOfTextAtSize(line, 8);
          const centerX = pageWidth / 2 - textWidth / 2;
          page.drawText(line, { 
            x: centerX, 
            y: footerY + (footerText.length - 1 - i) * 10, 
            size: 8, 
            font, 
            color: rgb(0, 0, 0) 
          });
        });
      };

      const addLogo = (page: any) => {
        if (logoImage) {
          const logoWidth = 170;
          const logoHeight = 50;
          const x = pageWidth - logoWidth - 25;
          const y = 780;
          
          page.drawImage(logoImage, {
            x,
            y,
            width: logoWidth,
            height: logoHeight
          });
        }
      };

      // === COVER PAGE ===
      const coverPage = pdfDoc.addPage([595.28, 841.89]);
      
      // Add logo on the left side - larger for cover
      if (logoImage) {
        const logoWidth = 200;
        const logoHeight = 58;
        const logoX = 60;
        const logoY = 650;
        
        coverPage.drawImage(logoImage, {
          x: logoX,
          y: logoY,
          width: logoWidth,
          height: logoHeight
        });
      }
      
      // Add "PRIVATE EQUITY PROPOSAL" text below logo
      const coverTitle = "PRIVATE EQUITY PROPOSAL";
      coverPage.drawText(coverTitle, { 
        x: 60, 
        y: 520, 
        size: 22, 
        font: boldFont,
        color: rgb(0, 0, 0)
      });

      // === PAGE 1: MAIN CONTENT ===
      const page1 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page1);
      addLogo(page1);
      let yPos = 680;

      // Title
      const pageTitle = `Turning R${quotation.investmentAmount.toLocaleString()} into R${quotation.maturityValue.toLocaleString()} in ${quotation.term} Years`;
      page1.drawText(pageTitle, { 
        x: leftMargin, 
        y: yPos, 
        size: 14, 
        font: boldFont 
      });

      yPos -= 40;

      // Client information
      page1.drawText("Prepared for:", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 25;
      page1.drawText(quotation.clientName, { x: leftMargin, y: yPos, size: 11, font });
      yPos -= 40;

      page1.drawText("Address:", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 25;
      const addressLines = quotation.clientAddress.split("\n");
      addressLines.forEach(line => {
        if (line.trim()) {
          page1.drawText(line, { x: leftMargin, y: yPos, size: 11, font });
          yPos -= 20;
        }
      });

      yPos -= 40; // Extra spacing before date
      const dateStr = quotation.calculationDate ? format(new Date(quotation.calculationDate), 'dd-MMM-yy') : format(new Date(), 'dd-MMM-yy');
      page1.drawText(`Date: ${dateStr}`, { x: leftMargin, y: yPos, size: 11, font });

      yPos -= 40;
      page1.drawText(`Dear ${quotation.clientName}`, { x: leftMargin, y: yPos, size: 11, font });

      yPos -= 30;
      page1.drawText("We thank you for your interest in our Private Equity Proposal", { 
        x: leftMargin, 
        y: yPos, 
        size: 11, 
        font 
      });

      yPos -= 40;

      // Executive Summary
      page1.drawText("Executive Summary", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;

      const executiveSummary = `This proposal outlines a strategic private equity (PE) investment strategy designed to grow an initial capital of R${quotation.investmentAmount.toLocaleString()} over a ${quotation.term}-year horizon. By leveraging high-growth private equity opportunities in carefully selected industries, we aim to maximize returns while mitigating risks through diversification and expert fund management.`;
      yPos = drawJustifiedText(page1, executiveSummary, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 35;

      // target value logic
      const amount = Number(quotation.investmentAmount) || 0;
      const term = Number(quotation.term) || 1;
      let maturityValue = Number(quotation.maturityValue) || 0;

      // Investment Summary Section
      page1.drawText("Investment Summary", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;

      const summaryData = [
        ["Initial Investment Amount:", `R${amount.toLocaleString()}`],
        ["Term:", `${term} Years`],
        ["Target Maturity Value:", `R${maturityValue.toLocaleString()}`]
      ];

      summaryData.forEach(([label, value]) => {
        page1.drawText(label, { x: leftMargin, y: yPos, size: 11, font: boldFont });
        page1.drawText(value, { x: leftMargin + 200, y: yPos, size: 11, font });
        yPos -= 20;
      });

      yPos -= 20;

      // Yearly breakdown table
      if (term === 3 || term === 5) {
        page1.drawText("Yearly Interest Breakdown:", { x: leftMargin, y: yPos, size: 12, font: boldFont });
        yPos -= 25;

        const tableX = leftMargin;
        const colWidth = 100;
        
        // Header
        page1.drawText("Year", { x: tableX, y: yPos, size: 10, font: boldFont });
        page1.drawText("Interest Rate", { x: tableX + colWidth, y: yPos, size: 10, font: boldFont });
        yPos -= 15;
        page1.drawLine({
          start: { x: tableX, y: yPos + 5 },
          end: { x: tableX + 200, y: yPos + 5 },
          thickness: 1,
        });

        const rates = term === 3 ? ["11.75%", "11.85%", "11.95%"] : ["13.10%", "13.20%", "13.30%", "13.40%", "13.50%"];
        
        rates.forEach((rate, index) => {
          page1.drawText(`Year ${index + 1}`, { x: tableX, y: yPos, size: 10, font });
          page1.drawText(rate, { x: tableX + colWidth, y: yPos, size: 10, font });
          yPos -= 15;
        });
      } else {
        page1.drawText(`Interest Rate: ${quotation.interestRate}%`, { x: leftMargin, y: yPos, size: 11, font: boldFont });
        yPos -= 20;
      }

      yPos -= 20;

      const pdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Quotation_${id}.pdf`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Interest Rate management
  app.get("/api/interest-rates", requireAuth, async (req, res) => {
    try {
      const rates = await db.select().from(interestRates);
      res.json(rates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch interest rates" });
    }
  });

  app.post("/api/interest-rates", requireAuth, async (req: any, res) => {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: "Only super admins can manage interest rates" });
    }
    try {
      const result = insertInterestRateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid rate data", errors: result.error.issues });
      }
      const [rate] = await db.insert(interestRates).values(result.data).returning();
      res.status(201).json(rate);
    } catch (error) {
      res.status(500).json({ message: "Failed to create interest rate" });
    }
  });

  app.put("/api/interest-rates/:id", requireAuth, async (req: any, res) => {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: "Only super admins can manage interest rates" });
    }
    try {
      const id = parseInt(req.params.id);
      const result = insertInterestRateSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid rate data", errors: result.error.issues });
      }
      const [rate] = await db.update(interestRates).set({ ...result.data, updatedAt: new Date() }).where(eq(interestRates.id, id)).returning();
      res.json(rate);
    } catch (error) {
      res.status(500).json({ message: "Failed to update interest rate" });
    }
  });

  app.delete("/api/interest-rates/:id", requireAuth, async (req: any, res) => {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: "Only super admins can manage interest rates" });
    }
    try {
      const id = parseInt(req.params.id);
      await db.delete(interestRates).where(eq(interestRates.id, id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete interest rate" });
    }
  });

  app.get("/api/kanban/boards", requireAuth, async (req: any, res) => {
    try {
      // Admin and super admin can see all boards, regular users see only their own
      const userId = hasAdminAccess(req.user.role) ? undefined : req.user.id;
      const boards = await storage.getKanbanBoards(userId);
      res.json(boards);
    } catch (error) {
      console.error("Error fetching kanban boards:", error);
      res.status(500).json({ error: "Failed to fetch kanban boards" });
    }
  });

  app.get("/api/kanban/boards/:id", requireAuth, async (req, res) => {
    try {
      const board = await storage.getKanbanBoard(parseInt(req.params.id));
      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }
      res.json(board);
    } catch (error) {
      console.error("Error fetching kanban board:", error);
      res.status(500).json({ error: "Failed to fetch kanban board" });
    }
  });

  app.post("/api/kanban/boards", requireAuth, async (req: any, res) => {
    try {
      const boardData = { ...req.body, userId: req.user.id };
      const board = await storage.createKanbanBoard(boardData);
      res.status(201).json(board);
    } catch (error) {
      console.error("Error creating kanban board:", error);
      res.status(500).json({ error: "Failed to create kanban board" });
    }
  });

  app.put("/api/kanban/boards/:id", requireAuth, async (req, res) => {
    try {
      const board = await storage.updateKanbanBoard(parseInt(req.params.id), req.body);
      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }
      res.json(board);
    } catch (error) {
      console.error("Error updating kanban board:", error);
      res.status(500).json({ error: "Failed to update kanban board" });
    }
  });

  app.delete("/api/kanban/boards/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteKanbanBoard(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ error: "Board not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting kanban board:", error);
      res.status(500).json({ error: "Failed to delete kanban board" });
    }
  });

  // Kanban Columns
  app.get("/api/kanban/boards/:boardId/columns", requireAuth, async (req, res) => {
    try {
      const boardId = parseInt(req.params.boardId);
      if (isNaN(boardId)) {
        return res.status(400).json({ error: "Invalid board ID" });
      }
      const columns = await storage.getKanbanColumns(boardId);
      res.json(columns);
    } catch (error) {
      console.error("Error fetching kanban columns:", error);
      res.status(500).json({ error: "Failed to fetch kanban columns" });
    }
  });

  app.post("/api/kanban/columns", requireAuth, async (req, res) => {
    try {
      const column = await storage.createKanbanColumn(req.body);
      res.status(201).json(column);
    } catch (error) {
      console.error("Error creating kanban column:", error);
      res.status(500).json({ error: "Failed to create kanban column" });
    }
  });

  app.put("/api/kanban/columns/:id", requireAuth, async (req, res) => {
    try {
      const column = await storage.updateKanbanColumn(parseInt(req.params.id), req.body);
      if (!column) {
        return res.status(404).json({ error: "Column not found" });
      }
      res.json(column);
    } catch (error) {
      console.error("Error updating kanban column:", error);
      res.status(500).json({ error: "Failed to update kanban column" });
    }
  });

  app.delete("/api/kanban/columns/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteKanbanColumn(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ error: "Column not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting kanban column:", error);
      res.status(500).json({ error: "Failed to delete kanban column" });
    }
  });

  // Kanban Cards
  app.get("/api/kanban/columns/:columnId/cards", requireAuth, async (req, res) => {
    try {
      const cards = await storage.getKanbanCards(parseInt(req.params.columnId));
      res.json(cards);
    } catch (error) {
      console.error("Error fetching kanban cards:", error);
      res.status(500).json({ error: "Failed to fetch kanban cards" });
    }
  });

  app.post("/api/kanban/cards", requireAuth, async (req, res) => {
    try {
      const card = await storage.createKanbanCard(req.body);
      res.status(201).json(card);
    } catch (error) {
      console.error("Error creating kanban card:", error);
      res.status(500).json({ error: "Failed to create kanban card" });
    }
  });

  app.put("/api/kanban/cards/:id", requireAuth, async (req, res) => {
    try {
      const card = await storage.updateKanbanCard(parseInt(req.params.id), req.body);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.json(card);
    } catch (error) {
      console.error("Error updating kanban card:", error);
      res.status(500).json({ error: "Failed to update kanban card" });
    }
  });

  app.put("/api/kanban/cards/:id/move", requireAuth, async (req, res) => {
    try {
      const { columnId, position } = req.body;
      const card = await storage.moveKanbanCard(parseInt(req.params.id), columnId, position);
      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.json(card);
    } catch (error) {
      console.error("Error moving kanban card:", error);
      res.status(500).json({ error: "Failed to move kanban card" });
    }
  });

  app.delete("/api/kanban/cards/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteKanbanCard(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting kanban card:", error);
      res.status(500).json({ error: "Failed to delete kanban card" });
    }
  });

  // Kanban Tasks
  app.get("/api/kanban/cards/:cardId/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getKanbanTasks(parseInt(req.params.cardId));
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching kanban tasks:", error);
      res.status(500).json({ error: "Failed to fetch kanban tasks" });
    }
  });

  app.post("/api/kanban/tasks", requireAuth, async (req, res) => {
    try {
      const result = insertKanbanTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid task data", errors: result.error.issues });
      }
      const task = await storage.createKanbanTask(result.data);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating kanban task:", error);
      res.status(500).json({ error: "Failed to create kanban task" });
    }
  });

  app.put("/api/kanban/tasks/:id", requireAuth, async (req, res) => {
    try {
      console.log("Updating task with ID:", req.params.id);
      console.log("Request body:", req.body);
      
      const result = insertKanbanTaskSchema.partial().safeParse(req.body);
      if (!result.success) {
        console.error("Validation failed:", result.error.issues);
        return res.status(400).json({ message: "Invalid task data", errors: result.error.issues });
      }
      
      console.log("Parsed data:", result.data);
      
      const task = await storage.updateKanbanTask(parseInt(req.params.id), result.data);
      if (!task) {
        console.error("Task not found for ID:", req.params.id);
        return res.status(404).json({ error: "Task not found" });
      }
      
      console.log("Updated task:", task);
      res.json(task);
    } catch (error) {
      console.error("Error updating kanban task:", error);
      res.status(500).json({ error: "Failed to update kanban task" });
    }
  });

  app.delete("/api/kanban/tasks/:id", requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteKanbanTask(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting kanban task:", error);
      res.status(500).json({ error: "Failed to delete kanban task" });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket server for real-time presence tracking
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store user connections
  const userConnections = new Map<number, WebSocket>();
  
  wss.on('connection', (ws: WebSocket) => {
    let userId: number | null = null;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'join' && data.userId) {
          userId = data.userId;
          userConnections.set(userId, ws);
          
          // Update user online status
          await storage.updateUser(userId, { isOnline: true, lastSeen: new Date() });
          
          // Broadcast user came online
          broadcastPresenceUpdate(userId, true);
          console.log(`User ${userId} connected via WebSocket`);
        } else if (data.type === 'heartbeat' && userId) {
          // Update last seen timestamp
          await storage.updateUser(userId, { lastSeen: new Date() });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', async () => {
      if (userId) {
        userConnections.delete(userId);
        
        // Add a small delay before marking offline to handle quick reconnections
        setTimeout(async () => {
          // Check if user has reconnected
          if (!userConnections.has(userId!)) {
            // Update user offline status
            await storage.updateUser(userId!, { isOnline: false, lastSeen: new Date() });
            
            // Broadcast user went offline
            broadcastPresenceUpdate(userId!, false);
            console.log(`User ${userId} marked as offline`);
          }
        }, 5000); // Wait 5 seconds before marking offline
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  function broadcastPresenceUpdate(userId: number, isOnline: boolean) {
    const message = JSON.stringify({
      type: 'presence_update',
      userId,
      isOnline,
      timestamp: new Date().toISOString()
    });
    
    userConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
  
  // API endpoint to get all users with their online status
  app.get("/api/users/presence", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users presence:", error);
      res.status(500).json({ error: "Failed to fetch users presence" });
    }
  });
  
  return httpServer;
}