import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { insertClientSchema, insertDocumentSchema, insertAppointmentSchema, insertTeamMemberSchema, insertKanbanTaskSchema, insertCdnQuotationSchema, cdnQuotations, interestRates, insertInterestRateSchema } from "@shared/schema";
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
      let page = doc.addPage();
      const { width, height } = page.getSize();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

      let y = height - 50;
      const margin = 50;
      const lineHeight = 15;

      // Title
      page.drawText(`Quotation for FlexMax Capital Appreciator Fixed Deposit Note ${quotation.term} Year Term`, {
        x: margin,
        y,
        size: 14,
        font: boldFont,
      });
      y -= lineHeight * 3;

      // Header Info
      page.drawText(`Date of Offer:`, { x: margin, y, size: 10, font });
      page.drawText(`${format(new Date(quotation.calculationDate), 'yyyy/MM/dd')}`, { x: margin + 150, y, size: 10, font });
      y -= lineHeight * 2;

      page.drawText(`Offered to:`, { x: margin, y, size: 10, font });
      page.drawText(`${quotation.clientName}`, { x: margin + 150, y, size: 10, font });
      y -= lineHeight;
      page.drawText(`Address:`, { x: margin, y, size: 10, font });
      const addressLines = quotation.clientAddress.split('\n');
      addressLines.forEach((line, i) => {
        page.drawText(line, { x: margin + 150, y: y - (i * lineHeight), size: 10, font });
      });
      y -= lineHeight * (Math.max(1, addressLines.length) + 1);

      page.drawText(`Telephone:`, { x: margin, y, size: 10, font });
      page.drawText(`${quotation.clientPhone || ''}`, { x: margin + 150, y, size: 10, font });
      y -= lineHeight;
      page.drawText(`Email:`, { x: margin, y, size: 10, font });
      page.drawText(`${client.email || ''}`, { x: margin + 150, y, size: 10, font });
      y -= lineHeight * 3;

      page.drawText(`Dear ${quotation.clientName}`, { x: margin, y, size: 10, font });
      y -= lineHeight;
      page.drawText(`We take pleasure in submitting the following proposal to you:`, { x: margin, y, size: 10, font });
      y -= lineHeight * 3;

      // INVESTMENT SUMMARY Section
      page.drawText(`INVESTMENT SUMMARY`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;

      const summaryItems = [
        ['Investment amount', `R ${quotation.investmentAmount.toLocaleString()}`],
        ['Amount allocated with enhancement', `R ${quotation.investmentAmount.toLocaleString()}`],
        ['Term in years', `${quotation.term}`],
        ['Commencement date', `${format(new Date(quotation.commencementDate), 'dd-MMM-yy')}`],
        ['Percentage returned first year', `${quotation.term === 1 ? '90%' : 'N/A'}`],
        ['Income allocated to capital in first year', quotation.term === 1 ? `R ${(quotation.investmentAmount * 0.9).toLocaleString()}` : 'N/A'],
        ['Liquidity', 'None'],
        ['', ''],
        ['Contract Start date', `${format(new Date(quotation.commencementDate), 'dd-MMM-yy')}`],
        ['Exit date', `${format(new Date(quotation.redemptionDate), 'dd-MMM-yy')}`],
        ['Return Cycle', 'Annually'],
        ['Capital allocation', '100%'],
      ];

      summaryItems.forEach(([label, value]) => {
        if (label) {
          page.drawText(label, { x: margin, y, size: 10, font });
          page.drawText(value, { x: margin + 250, y, size: 10, font });
        }
        y -= lineHeight;
      });

      y -= lineHeight * 2;
      
      // Footer text for first page
      const footerY = 50;
      page.drawText(`Registered Address: 220 Ashwood Avenue, Waterkloof Glen, 0181, Pretoria         Fund Advice: Sovereign Trust International Limited`, { x: margin, y: footerY + 15, size: 7, font });
      page.drawText(`Email: info@opiansapital.com Website: www.opiansapital.com              Sovereign Place, 117 Main Street, GX11 1AA, Gibraltar, GI`, { x: margin, y: footerY, size: 7, font });

      // NEW PAGE: INCOME PROJECTIONS
      page = doc.addPage();
      const { height: pageHeight, width: pageWidth } = page.getSize();
      y = pageHeight - 50;

      page.drawText(`INCOME PROJECTIONS`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 2;

      page.drawText(`Year`, { x: margin, y, size: 10, font: boldFont });
      page.drawText(`Capital Value`, { x: margin + 100, y, size: 10, font: boldFont });
      page.drawText(`Return Forecast`, { x: margin + 300, y, size: 10, font: boldFont });
      y -= lineHeight * 1.5;

      page.drawText(`Current`, { x: margin, y, size: 10, font });
      page.drawText(`R ${quotation.investmentAmount.toLocaleString()}`, { x: margin + 100, y, size: 10, font });
      page.drawText(`Projected: ${quotation.interestRate}`, { x: margin + 300, y, size: 10, font });
      y -= lineHeight * 1.5;

      page.drawText(`${quotation.term}`, { x: margin, y, size: 10, font });
      page.drawText(`R ${quotation.maturityValue.toLocaleString()}`, { x: margin + 100, y, size: 10, font });
      page.drawText(`R ${(quotation.maturityValue - quotation.investmentAmount).toLocaleString()}`, { x: margin + 300, y, size: 10, font });
      y -= lineHeight * 3;

      // MODELLED FUND CHOICES Section
      page.drawText(`MODELLED FUND CHOICES`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;

      page.drawText(`ISIN`, { x: margin, y, size: 10, font: boldFont });
      page.drawText(`Fund Name`, { x: margin + 150, y, size: 10, font: boldFont });
      page.drawText(`Type`, { x: margin + 350, y, size: 10, font: boldFont });
      page.drawText(`Split`, { x: margin + 450, y, size: 10, font: boldFont });
      y -= lineHeight * 1.5;

      page.drawText(`SIN Code: DG00U67BC567`, { x: margin, y, size: 9, font });
      page.drawText(`WSF Global Equity Fund`, { x: margin + 150, y, size: 9, font });
      page.drawText(`Risk Adverse`, { x: margin + 350, y, size: 9, font });
      page.drawText(`100%`, { x: margin + 450, y, size: 9, font });
      y -= lineHeight * 3;

      // CONDITIONS Section
      page.drawText(`CONDITIONS`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;

      const conditions = [
        "1. To effectively evaluate this product against comparable alternatives, it is essential to analyze and contrast its risk reward profile with those of similar products offering analogous risk reward structures.",
        "2. This offer involves the purchase of Fixed Deposit Notes (FDN's) in private equity. Given the inherent risks associated we strongly recommend independent advice before making any commitment.",
        "3. This offer contains no guarantees beyond those expressly stated herein. Upon signing, the terms outlined in this offer shall constitute a legally binding agreement between the client and the company.",
        "4. The applicant acknowledges understanding of the complexities involving this investment as well as the lock-in periods contained in the investment.",
        "5. The applicant understands that a loan agreement will come into existence after signature of this quotation and that returns paid are mirrored on the performance of the selected fund above.",
        "6. The applicant understands the zero liquidity nature of this investment and has ensured that he has enough liquid investments or savings to ensure liquidity during this investment.",
        "7. The applicant understands that the directors or trustees of company funds, in their collective capacity, may limit, withhold, defer or reduce payments or payouts as necessary at moment's notice to safeguard the company's liquidity requirements and ensure financial stability.",
        "8. The individual, individuals or organisation's entering into this agreement acknowledges and understands that this is a fixed-term contract, as specified in the duration outlined above, the term \"Exit Date\" refers to the agreed-upon end date of the agreement.",
        "9. The applicant understands that if shares are issued under this agreement, the shares are issued for security only and are returnable when the applicant is paid back his invested capital.",
        "10. The applicant retains the option to convert their capital to fixed shares at exit date; whereafter the par value of the converted shares will be based on a comprehensive company's valuation at the time of exit."
      ];

      conditions.forEach(condition => {
        const words = condition.split(' ');
        let currentLine = '';
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (font.widthOfTextAtSize(testLine, 9) > pageWidth - (margin * 2)) {
            page.drawText(currentLine, { x: margin, y, size: 9, font });
            y -= 11;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        page.drawText(currentLine, { x: margin, y, size: 9, font });
        y -= 15;
      });

      y -= lineHeight;

      // VALIDITY Section
      page.drawText(`VALIDITY`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;
      const validityText = "This offer remains valid for a period of 14 days from the date of issuance, it is imperative that the receipt of funds occur within this specific time frame. All required documentation must be completed, and funds transfers finalized on or before expiration of the offers validity period. Should any information remain outstanding or incomplete, funds will be processed, a new offer must be issued and duly executed before the terms can be formally accepted by the company.";
      
      const wordsValidity = validityText.split(' ');
      let currentLineValidity = '';
      wordsValidity.forEach(word => {
        const testLine = currentLineValidity ? `${currentLineValidity} ${word}` : word;
        if (font.widthOfTextAtSize(testLine, 9) > pageWidth - (margin * 2)) {
          page.drawText(currentLineValidity, { x: margin, y, size: 9, font });
          y -= 11;
          currentLineValidity = word;
        } else {
          currentLineValidity = testLine;
        }
      });
      page.drawText(currentLineValidity, { x: margin, y, size: 9, font });
      y -= lineHeight * 3;

      // PLACEMENT AND ADMIN FEES
      page.drawText(`PLACEMENT AND ADMIN FEES`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;
      page.drawText(`Description`, { x: margin, y, size: 10, font: boldFont });
      page.drawText(`Frequency`, { x: margin + 200, y, size: 10, font: boldFont });
      page.drawText(`Percentage`, { x: margin + 350, y, size: 10, font: boldFont });
      y -= lineHeight * 1.2;
      page.drawText(`Placement fee`, { x: margin, y, size: 10, font });
      page.drawText(`Once Off`, { x: margin + 200, y, size: 10, font });
      page.drawText(`1.00%`, { x: margin + 350, y, size: 10, font });
      y -= lineHeight;
      page.drawText(`Admin Fees`, { x: margin, y, size: 10, font });
      page.drawText(`Once Off`, { x: margin + 200, y, size: 10, font });
      page.drawText(`0.50%`, { x: margin + 350, y, size: 10, font });
      y -= lineHeight * 3;

      // COMMISSION
      page.drawText(`COMMISSION`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;
      page.drawText(`Description`, { x: margin, y, size: 10, font: boldFont });
      page.drawText(`Frequency`, { x: margin + 200, y, size: 10, font: boldFont });
      page.drawText(`Percentage`, { x: margin + 350, y, size: 10, font: boldFont });
      y -= lineHeight * 1.2;
      page.drawText(`Commission`, { x: margin, y, size: 10, font });
      page.drawText(`First Year`, { x: margin + 200, y, size: 10, font });
      page.drawText(`0.50%`, { x: margin + 350, y, size: 10, font });
      y -= lineHeight * 3;

      // AGREEMENT DETAILS
      page.drawText(`AGREEMENT DETAILS`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;
      page.drawText(`Agreement number:`, { x: margin, y, size: 10, font });
      page.drawText(`36456453654`, { x: margin + 150, y, size: 10, font });
      y -= lineHeight;
      page.drawText(`Investor Name:`, { x: margin, y, size: 10, font });
      page.drawText(`${quotation.clientName}`, { x: margin + 150, y, size: 10, font });
      y -= lineHeight * 4;

      page.drawText(`Signature of investor: _________________________________`, { x: margin, y, size: 10, font });
      y -= lineHeight * 3;

      // SUPPORT DOCUMENTATION
      page.drawText(`SUPPORT DOCUMENTATION`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;
      const docsList = ["Application form", "Copy of Identity Document / Passport", "Proof of Address", "Bank Statement"];
      docsList.forEach(docName => {
        page.drawText(`[ ] ${docName}`, { x: margin, y, size: 10, font });
        y -= lineHeight;
      });

      const pdfBytes = await doc.save();
      const fileName = `Quotation_${quotation.clientName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
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
        const logoPath = path.join(__dirname, "../attached_assets/image_1756974781134.png");
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

      // === Calculations ===
      const targetValue = quotation.investmentAmount * (1 + (Number(quotation.interestRate) || 0) / 100);
      const totalProfit = targetValue - quotation.investmentAmount;
      const sharesIssued = quotation.investmentAmount / 8;
      // Using maturityValue and other fields from quotation if available, otherwise defaulting to 0
      const year1Return = sharesIssued * (quotation.yearlyDivAllocation || 0);
      const year2Return = sharesIssued * (quotation.yearlyDivAllocation || 0);
      const year3Return = sharesIssued * (quotation.yearlyDivAllocation || 0);
      const year1Value = quotation.investmentAmount + year1Return;
      const year2Value = year1Value + year2Return;
      const year3Value = year2Value + year3Return;
      const term = Number(quotation.term) || 1;
      const annualizedReturn = Math.pow(targetValue / quotation.investmentAmount, 1 / term) - 1;

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

      // Title with dynamic values
      const pageTitle = `Turning R${quotation.investmentAmount.toLocaleString()} into R${targetValue.toLocaleString()} (${quotation.interestRate}% Growth) in ${quotation.term} Years`;
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

      const executiveSummary = `This proposal outlines a strategic private equity (PE) investment strategy designed to grow an initial capital of R${quotation.investmentAmount.toLocaleString()} by ${quotation.interestRate}% (R${targetValue.toLocaleString()} total) over a ${quotation.term}-year horizon. By leveraging high-growth private equity opportunities in carefully selected industries, we aim to maximize returns while mitigating risks through diversification and expert fund management.`;
      yPos = drawJustifiedText(page1, executiveSummary, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 35;

      // Investment Summary Section
      page1.drawText("Investment Summary", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;

      const summaryData = [
        ["Target Investment Value:", `R${targetValue.toLocaleString()}`],
        ["Total Profit:", `R${totalProfit.toLocaleString()}`],
        ["Target Return:", `${quotation.interestRate}%`],
        ["Annualized Return:", `${(annualizedReturn * 100).toFixed(1)}%`]
      ];

      summaryData.forEach(([label, value]) => {
        page1.drawText(label, { x: leftMargin, y: yPos, size: 11, font: boldFont });
        page1.drawText(value, { x: leftMargin + 200, y: yPos, size: 11, font });
        yPos -= 20;
      });

      yPos -= 15;

      // === PAGE 1B: KEY HIGHLIGHTS (to avoid footer overlap) ===
      const page1b = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page1b);
      addLogo(page1b);
      yPos = 720;

      // Key Highlights
      page1b.drawText("Key Highlights:", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 20;

      const highlights = [
        `• Target Return: ${quotation.interestRate}% growth (R${(targetValue - quotation.investmentAmount).toLocaleString()} profit) in ${quotation.term} years (~${(annualizedReturn * 100).toFixed(0)}% annualized return).`,
        "• Investment Strategy: Focus on growth equity in high-potential sectors.",
        "• Risk Management: Portfolio diversification, and active management.",
        `• Exit Strategy: Share buybacks, IPOs, or secondary buyouts after ${quotation.term} years.`
      ];

      highlights.forEach(highlight => {
        yPos = drawJustifiedText(page1b, highlight, leftMargin, yPos, contentWidth, font, 11);
        yPos -= 10;
      });

      // === PAGE 2: INVESTMENT OPPORTUNITY ===
      const page2 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page2);
      addLogo(page2);
      yPos = 750;

      // Investment Opportunity & Market Outlook
      page2.drawText("Investment Opportunity & Market Outlook", { 
        x: leftMargin, 
        y: yPos, 
        size: 12, 
        font: boldFont 
      });
      yPos -= 25;

      const marketText = "Private equity has historically outperformed public markets, delivering 12-25%+ annual returns in emerging markets like South Africa and BRICS. Key sectors with strong growth potential include:";
      yPos = drawJustifiedText(page2, marketText, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 20;

      const sectors = [
        "Technology & FinTech (Digital payments, SaaS, AI Related business)",
        "Consumer Goods & Retail (E-commerce, premium brands, Rewards, Lifestyle products)",
        "Healthcare & Pharma (Telemedicine, generics manufacturing)",
        "Renewable Energy (Solar, battery storage)"
      ];

      sectors.forEach(sector => {
        page2.drawText(sector, { x: leftMargin, y: yPos, size: 11, font });
        yPos -= 17;
      });

      yPos -= 20;

      const investText = "By investing in early stage but undervalued businesses with strong cash flow, IP and scalability, we position the portfolio for accelerated growth.";
      yPos = drawJustifiedText(page2, investText, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 40;

      // Proposed Investment Structure
      page2.drawText("Proposed Investment Structure", { 
        x: leftMargin, 
        y: yPos, 
        size: 12, 
        font: boldFont 
      });
      yPos -= 30;

      // Investment Structure Table
      const tableData = [
        ["Component", "Details"],
        ["Investment Amount", `R${quotation.investmentAmount.toLocaleString()}, 00`],
        ["Target Growth", `${quotation.interestRate}%`],
        ["Term", `${quotation.term} Years`],
        ["Target Value", `R${targetValue.toLocaleString()}, 00`],
        ["Shares Issued", sharesIssued.toLocaleString()],
      ];

      tableData.forEach(([label, value]) => {
        page2.drawText(label, { x: leftMargin, y: yPos, size: 11, font: boldFont });
        page2.drawText(value, { x: leftMargin + 200, y: yPos, size: 11, font });
        yPos -= 20;
      });

      yPos -= 30;

      // Dividend Schedule
      page2.drawText("Projected Dividend Schedule", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;

      const dividendData = [
        ["Year 1", `R${year1Return.toLocaleString()}`, `R${year1Value.toLocaleString()}`],
        ["Year 2", `R${year2Return.toLocaleString()}`, `R${year2Value.toLocaleString()}`],
        ["Year 3", `R${year3Return.toLocaleString()}`, `R${year3Value.toLocaleString()}`],
      ];

      page2.drawText("Year", { x: leftMargin, y: yPos, size: 10, font: boldFont });
      page2.drawText("Dividend", { x: leftMargin + 100, y: yPos, size: 10, font: boldFont });
      page2.drawText("Total Value", { x: leftMargin + 250, y: yPos, size: 10, font: boldFont });
      yPos -= 20;

      dividendData.forEach(([year, div, val]) => {
        page2.drawText(year, { x: leftMargin, y: yPos, size: 10, font });
        page2.drawText(div, { x: leftMargin + 100, y: yPos, size: 10, font });
        page2.drawText(val, { x: leftMargin + 250, y: yPos, size: 10, font });
        yPos -= 15;
      });

      // === PAGE 3: WHY PRIVATE EQUITY ===
      const page3 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page3);
      addLogo(page3);
      yPos = 750;

      page3.drawText("Why Private Equity?", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;

      const whyPEReasons = [
        "• Higher Returns: PE typically outperforms stocks & bonds.",
        "• Active Value Creation: Hands-on management improves business performance.",
        "• Lower Volatility: Unlike public markets, PE is less exposed to short-term fluctuations."
      ];

      whyPEReasons.forEach(reason => {
        page3.drawText(reason, { x: leftMargin, y: yPos, size: 11, font });
        yPos -= 20;
      });

      // === PAGE 4: PROJECTED RETURNS ===
      const page4 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page4);
      addLogo(page4);
      yPos = 750;

      page4.drawText("Projected Returns & Cash Flow", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 30;

      const cashFlowData = [
        ["Year", "Shares Issued", "Div Allocation", "Div Return", "Growth (%)", "Investment Value"],
        ["Year 0", "-", "-", "-", "-", `R${quotation.investmentAmount.toLocaleString()}, 00`],
        ["Year 1", Math.floor(sharesIssued).toLocaleString(), (quotation.yearlyDivAllocation || 0).toFixed(3), `R${Math.round(year1Return).toLocaleString()}`, `${((year1Return / quotation.investmentAmount) * 100).toFixed(2)}%`, `R${Math.round(year1Value).toLocaleString()}`],
        ["Year 2", Math.floor(sharesIssued).toLocaleString(), (quotation.yearlyDivAllocation || 0).toFixed(3), `R${Math.round(year2Return).toLocaleString()}`, `${((year2Return / year1Value) * 100).toFixed(2)}%`, `R${Math.round(year2Value).toLocaleString()}`],
        ["Year 3", Math.floor(sharesIssued).toLocaleString(), (quotation.yearlyDivAllocation || 0).toFixed(3), `R${Math.round(year3Return).toLocaleString()}`, `${((year3Return / year2Value) * 100).toFixed(2)}%`, `R${Math.round(year3Value).toLocaleString()}`]
      ];

      const colWidths = [60, 85, 85, 85, 70, 100];
      let tableTop = yPos;

      cashFlowData.forEach((row, rowIndex) => {
        const currentY = tableTop - (rowIndex * 25);
        const isHeader = rowIndex === 0;
        let xPos = leftMargin;
        row.forEach((cell, colIndex) => {
          page4.drawRectangle({ x: xPos, y: currentY - 25, width: colWidths[colIndex], height: 25, borderColor: rgb(0, 0, 0), borderWidth: 1 });
          page4.drawText(cell, { x: xPos + 4, y: currentY - 15, size: 9, font: isHeader ? boldFont : font });
          xPos += colWidths[colIndex];
        });
      });

      yPos = tableTop - (cashFlowData.length * 25) - 25;

      const notes = [
        "• Note: While returns are based on historical PE performance; actual results may vary.",
        "• Fund Value is non liquid",
        "• The investment is locked into the period with no access to investment"
      ];

      notes.forEach(note => {
        page4.drawText(note, { x: leftMargin, y: yPos, size: 11, font });
        yPos -= 20;
      });

      yPos -= 40;
      page4.drawText("Risk Mitigation Strategy", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 30;

      const riskIntro = "To safeguard capital while pursuing high returns, we implement:";
      yPos = drawJustifiedText(page4, riskIntro, leftMargin, yPos, contentWidth, font, 11);
      yPos -= 25;

      const riskStrategies = [
        "• Diversification across 1-5 high-growth potential companies",
        "• Due Diligence on management teams, financials, and market trends",
        "• Structured Exit Plans (Share swops, IPO, recapitalization, buyouts)",
        "• Co-Investment Model (Reduces exposure via partnerships)"
      ];

      riskStrategies.forEach(strategy => {
        page4.drawText(strategy, { x: leftMargin, y: yPos, size: 11, font });
        yPos -= 20;
      });

      yPos -= 30;
      page4.drawText("Why Invest With Us?", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 30;

      const whyUsPoints = [
        "• Industry Expertise: Deep knowledge of South African & African markets",
        "• Transparent Fees: Performance-based compensation (2% management fee + 20% carry)",
        "• Aligned Interests: We invest alongside clients",
        "• Ownership: We take ownership and management stake in companies we invest in"
      ];

      whyUsPoints.forEach(point => {
        page4.drawText(point, { x: leftMargin, y: yPos, size: 11, font });
        yPos -= 20;
      });

      // === PAGE 5: NEXT STEPS ===
      const page5 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page5);
      addLogo(page5);
      yPos = 750;

      page5.drawText("Next Steps", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 30;

      const nextSteps = [
        "1. Decision Taking: Deciding on risk appetite & capital to be invested",
        "2. FAIS Process: Making investment and completing documentation",
        "3. Capital Deployment: We begin investment within 2-6 weeks post due diligence.",
        "4. Quarterly Reporting: Transparent updates on performance."
      ];

      nextSteps.forEach(step => {
        yPos = drawJustifiedText(page5, step, leftMargin, yPos, contentWidth, font, 11);
        yPos -= 15;
      });

      yPos -= 30;
      page5.drawText("Conclusion", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 30;

      const conclusion = "This private equity strategy offers a compelling opportunity for superior growth on your investment by leveraging equity in high-growth, privately held businesses. With disciplined risk management and sector expertise, we are confident in delivering superior returns.";
      yPos = drawJustifiedText(page5, conclusion, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 25;
      const thankYou = "Thank you for your consideration. Please reach out to me if there are further concerns or let's discuss how we can tailor this strategy to your goals.";
      yPos = drawJustifiedText(page5, thankYou, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 40;
      page5.drawText("Kind Regards", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 40;

      const disclaimerText = "*Disclaimer: This proposal is for illustrative purposes only. Past performance is not indicative of future results. Private equity involves risk, including potential loss of capital. Investors should conduct independent due diligence before committing funds.";
      yPos = drawJustifiedText(page5, disclaimerText, leftMargin, yPos, contentWidth, font, 9, 15);
      yPos -= 25;

      const proposalText = "*This proposal, when signed and accepted, will become part of the Agreement with the client";
      yPos = drawJustifiedText(page5, proposalText, leftMargin, yPos, contentWidth, font, 9, 15);

      // === PAGE 6: CLIENT CONFIRMATION ===
      const page6 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page6);
      addLogo(page6);
      yPos = 750;

      page6.drawText("CLIENT CONFIRMATION", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 30;

      const confirmationText = "I, The undersigned, hereby accept the proposal as outlined in the documentation contained herein. I confirmed that I had made an informed decision based on my own financial product experience and/or external consultation with professionals. I confirm that I have the financial capacity to enter into this agreement and also the additional financial resources which allow me the opportunity to enter the waiting periods/ lock up periods/ and or risk associated with this product";
      yPos = drawJustifiedText(page6, confirmationText, leftMargin, yPos, contentWidth, font, 11);

      yPos -= 60;
      page6.drawText("__________________________", { x: leftMargin, y: yPos, size: 12, font });
      page6.drawText("__________________________", { x: leftMargin + 250, y: yPos, size: 12, font });
      yPos -= 15;
      page6.drawText("Client Signature", { x: leftMargin, y: yPos, size: 10, font });
      page6.drawText("Date", { x: leftMargin + 250, y: yPos, size: 10, font });

      yPos -= 50;
      page6.drawText("__________________________", { x: leftMargin, y: yPos, size: 12, font });
      page6.drawText("__________________________", { x: leftMargin + 250, y: yPos, size: 12, font });
      yPos -= 15;
      page6.drawText("Witness Signature", { x: leftMargin, y: yPos, size: 10, font });
      page6.drawText("Date", { x: leftMargin + 250, y: yPos, size: 10, font });

      const pdfBytes = await pdfDoc.save();
      const fileName = `Proposal_${quotation.clientName.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
      const filePath = path.join(uploadsDir, fileName);
      await fs.promises.writeFile(filePath, pdfBytes);

      // Save as document record
      await storage.createDocument({
        name: fileName,
        originalName: fileName,
        size: pdfBytes.length,
        type: "application/pdf",
        clientId: quotation.clientId,
        userId: req.user.id,
      });

      res.contentType("application/pdf");
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error("PDF Generation error:", error);
      res.status(500).json({ message: "Failed to generate proposal PDF" });
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
          
          // Process user online status
          await storage.updateUser(Number(userId), { isOnline: true, lastSeen: new Date() });

          // Broadcast user came online
          broadcastPresenceUpdate(Number(userId), true);
          console.log(`User ${userId} connected via WebSocket`);
        } else if (data.type === 'heartbeat' && userId) {
          // Update last seen timestamp
          await storage.updateUser(Number(userId), { lastSeen: new Date() });
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