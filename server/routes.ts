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
      const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);

      // Load logo images
      let opianLogo: any = null;
      let flexMaxLogo: any = null;
      let logoImage: any = null;
      try {
        const opianLogoPath = path.join(process.cwd(), "client/public/opian-logo.png");
        const flexMaxLogoPath = path.join(process.cwd(), "client/public/flexmax-logo.png");
        
        const opianLogoBytes = await fs.promises.readFile(opianLogoPath);
        const flexMaxLogoBytes = await fs.promises.readFile(flexMaxLogoPath);
        
        opianLogo = await doc.embedPng(opianLogoBytes);
        flexMaxLogo = await doc.embedPng(flexMaxLogoBytes);
        logoImage = opianLogo;
      } catch (error) {
        console.warn("Could not load logo images for download route:", error);
      }

      let y = height - 50;
      const margin = 50;
      const lineHeight = 15;

      // Draw Logos
      if (opianLogo) {
        const logoWidth = 150;
        const logoHeight = 45;
        page.drawImage(opianLogo, {
          x: margin,
          y: height - 75,
          width: logoWidth,
          height: logoHeight
        });
      }
      if (flexMaxLogo) {
        const logoWidth = 150;
        const logoHeight = 35;
        page.drawImage(flexMaxLogo, {
          x: width - margin - logoWidth,
          y: height - 70,
          width: logoWidth,
          height: logoHeight
        });
      }
      
      y -= 60; // Adjust starting y after logos

      const isIncomeProvider = quotation.type === "income_provider";

      // Title
      page.drawText(`Quotation for FlexMax ${isIncomeProvider ? "Income Provider" : "Capital Appreciator"} Fixed Deposit Note ${quotation.term} Year Term`, {
        x: margin,
        y,
        size: 14,
        font: boldFont,
      });
      y -= lineHeight * 3;

      if (isIncomeProvider) {
        // Income Provider Specific Format
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
        y -= addressLines.length * lineHeight + lineHeight;

        page.drawText(`Telephone:`, { x: margin, y, size: 10, font });
        page.drawText(`${quotation.clientPhone || ''}`, { x: margin + 150, y, size: 10, font });
        y -= lineHeight * 2;

        page.drawText(`Dear ${quotation.clientName}`, { x: margin, y, size: 10, font });
        y -= lineHeight * 2;

        page.drawText(`We take pleasure in submitting the following proposal to you:`, { x: margin, y, size: 10, font });
        y -= lineHeight * 2;

        page.drawText(`Investment summary`, { x: margin, y, size: 11, font: boldFont });
        y -= lineHeight * 1.5;

        const summaryItems = [
          [`Investment amount`, `R${(quotation.investmentAmount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
          [`Amount allocated to Income payments with enhancement`, `R${(quotation.investmentAmount * (1 + (quotation.investmentBooster || 0) / 100)).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
          [`Term in years`, `${quotation.term}`],
          [`Commencement date`, `${format(new Date(quotation.commencementDate), 'd-MMM-yy')}`],
          [`Percentage returned first year`, `10.25%`],
          [`Income Payment annual amount received in first year`, `R${(quotation.investmentAmount * 0.107625).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`],
          [`Liquidity`, `None`],
        ];

        summaryItems.forEach(([label, value]) => {
          page.drawText(label, { x: margin, y, size: 10, font });
          page.drawText(value, { x: margin + 350, y, size: 10, font: boldFont });
          y -= lineHeight;
        });

        y -= lineHeight;
        const detailsItems = [
          [`Contract Start date`, `${format(new Date(quotation.commencementDate), 'd-MMM-yy')}`],
          [`Exit date`, `${format(new Date(quotation.redemptionDate), 'd-MMM-yy')}`],
          [`Income allocation cycle`, `${quotation.incomeAllocation || 'Annually'}`],
          [`Capital allocation`, `100%`],
        ];

        detailsItems.forEach(([label, value]) => {
          page.drawText(label, { x: margin, y, size: 10, font });
          page.drawText(value, { x: margin + 350, y, size: 10, font: boldFont });
          y -= lineHeight;
        });

        y -= lineHeight * 2;
        page.drawText(`Income projections`, { x: margin, y, size: 11, font: boldFont });
        y -= lineHeight * 0.5;

        // Draw Table exactly like image
        const tableWidth = width - (2 * margin);
        const colWidths = [
          tableWidth * 0.08,  // Year
          tableWidth * 0.32,  // Capital Value
          tableWidth * 0.28,  // Middle Gray/Empty
          tableWidth * 0.18,  // Income Taken Annual
          tableWidth * 0.14   // Income Taken Monthly
        ];
        const rowHeight = 22;
        
        const drawCell = (x: number, y: number, w: number, h: number, text: string, align: 'left' | 'center' | 'right' = 'left', bold = false, fill?: boolean) => {
          if (fill) {
            page.drawRectangle({ x, y, width: w, height: h, color: rgb(0.9, 0.9, 0.9), borderColor: rgb(0, 0, 0), borderWidth: 1 });
          } else {
            page.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0, 0, 0), borderWidth: 1 });
          }
          if (text) {
            const textFont = bold ? boldFont : font;
            const textWidth = textFont.widthOfTextAtSize(text, 9);
            let textX = x + 5;
            if (align === 'center') textX = x + (w - textWidth) / 2;
            if (align === 'right') textX = x + w - textWidth - 5;
            page.drawText(text, {
              x: textX,
              y: y + (h - 9) / 2,
              size: 9,
              font: textFont
            });
          }
        };

        // Header Structure
        let currentY = y;
        
        // Top row
        drawCell(margin, currentY - rowHeight, colWidths[0], rowHeight, "", 'center', true); // Year placeholder
        drawCell(margin + colWidths[0], currentY - rowHeight, colWidths[1] + colWidths[2], rowHeight, "Projection Scenarios", 'center', true);
        drawCell(margin + colWidths[0] + colWidths[1] + colWidths[2], currentY - rowHeight, colWidths[3] + colWidths[4], rowHeight, "", 'center');
        currentY -= rowHeight;

        // Second row
        drawCell(margin, currentY - rowHeight, colWidths[0], rowHeight, "Year", 'center', true); // Year label
        drawCell(margin + colWidths[0], currentY - rowHeight, colWidths[1], rowHeight, "Capital Value", 'center');
        drawCell(margin + colWidths[0] + colWidths[1], currentY - rowHeight, colWidths[2], rowHeight, "", 'center');
        drawCell(margin + colWidths[0] + colWidths[1] + colWidths[2], currentY - rowHeight, colWidths[3] + colWidths[4], rowHeight, "Income Taken", 'center');
        currentY -= rowHeight;

        // Third row
        drawCell(margin, currentY - rowHeight, colWidths[0], rowHeight, "", 'center');
        drawCell(margin + colWidths[0], currentY - rowHeight, colWidths[1], rowHeight, "Current", 'center');
        drawCell(margin + colWidths[0] + colWidths[1], currentY - rowHeight, colWidths[2], rowHeight, "", 'center', false, true); // Gray box
        drawCell(margin + colWidths[0] + colWidths[1] + colWidths[2], currentY - rowHeight, colWidths[3], rowHeight, "Annual", 'center');
        drawCell(margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY - rowHeight, colWidths[4], rowHeight, "Monthly", 'center');
        currentY -= rowHeight;

        // Data Rows
        const boosterMult = 1 + (quotation.investmentBooster || 0) / 100;
        const projections = [
          { year: 1, capital: quotation.investmentAmount * boosterMult, rate: "10.25%", amount: (quotation.investmentAmount * boosterMult) * 0.1025 },
          { year: 2, capital: quotation.investmentAmount * boosterMult, rate: "10.35%", amount: (quotation.investmentAmount * boosterMult) * 0.1035 },
          { year: 3, capital: quotation.investmentAmount, rate: "10.45%", amount: quotation.investmentAmount * 0.1045 },
        ];

        projections.forEach((row, i) => {
          if (row.year <= quotation.term) {
            drawCell(margin, currentY - rowHeight, colWidths[0], rowHeight, row.year.toString(), 'center');
            drawCell(margin + colWidths[0], currentY - rowHeight, colWidths[1], rowHeight, `R${row.capital.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 'center');
            drawCell(margin + colWidths[0] + colWidths[1], currentY - rowHeight, colWidths[2], rowHeight, "", 'center', false, true); // Gray middle
            
            // Annual column split visually
            const annualX = margin + colWidths[0] + colWidths[1] + colWidths[2];
            drawCell(annualX, currentY - rowHeight, colWidths[3] * 0.4, rowHeight, row.rate, 'center');
            drawCell(annualX + colWidths[3] * 0.4, currentY - rowHeight, colWidths[3] * 0.6, rowHeight, `R${row.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 'right');
            
            drawCell(margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY - rowHeight, colWidths[4], rowHeight, "N/A", 'center');
            currentY -= rowHeight;
          }
        });

        // Footer Row
        const totalGrowthAmt = projections.filter(p => p.year <= quotation.term).reduce((sum, p) => sum + p.amount, 0);
        
        drawCell(margin, currentY - rowHeight, colWidths[0] + colWidths[1], rowHeight, "", 'left', false, true); // Gray footer start
        drawCell(margin + colWidths[0] + colWidths[1], currentY - rowHeight, colWidths[2] * 0.7, rowHeight, "Growth Return Over Time", 'center');
        drawCell(margin + colWidths[0] + colWidths[1] + colWidths[2] * 0.7, currentY - rowHeight, colWidths[2] * 0.3, rowHeight, `R${totalGrowthAmt.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 'center', true);
        drawCell(margin + colWidths[0] + colWidths[1] + colWidths[2], currentY - rowHeight, colWidths[3] + colWidths[4] * 0.5, rowHeight, "Capital Returned", 'center');
        drawCell(margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] * 0.5, currentY - rowHeight, colWidths[4] * 0.5, rowHeight, `R${quotation.investmentAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 'center', true);
        
        y = currentY - rowHeight - 20;

      } else {
        // Capital Appreciator Format (Keep existing or update if needed)
        page.drawText(`Date of Offer:`, { x: margin, y, size: 10, font });
        page.drawText(`${format(new Date(quotation.calculationDate), 'yyyy/MM/dd')}`, { x: margin + 150, y, size: 10, font });
        y -= lineHeight * 2;
        // ... rest of existing format for capital appreciator
      }
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

      const boostedAmount = quotation.investmentAmount * (1 + (quotation.investmentBooster || 0) / 100);
      const firstYearRate = isIncomeProvider 
        ? (quotation.term === 3 ? "10.25%" : "11.50%")
        : (quotation.term === 1 ? quotation.interestRate : (quotation.term === 3 ? "11.75%" : "13.10%"));

      const summaryItems: [string, string][] = [
        ['Investment amount', `R ${quotation.investmentAmount.toLocaleString()}`],
        [isIncomeProvider ? 'Amount allocated to Income payments with enhancement' : 'Amount allocated with enhancement', `R ${boostedAmount.toLocaleString()}`],
        ['Term in years', `${quotation.term}`],
        ['Commencement date', `${format(new Date(quotation.commencementDate), 'dd-MMM-yy')}`],
        ['Percentage returned first year', firstYearRate || "0%"],
        [isIncomeProvider ? 'Income Payment annual amount received in first year' : 'Income allocated to capital in first year', `R ${(boostedAmount * (parseFloat(firstYearRate || "0") / 100)).toLocaleString()}`],
        ['Liquidity', 'None'],
        ['', ''],
        ['Contract Start date', `${format(new Date(quotation.commencementDate), 'dd-MMM-yy')}`],
        ['Exit date', `${format(new Date(quotation.redemptionDate), 'dd-MMM-yy')}`],
        [isIncomeProvider ? 'Income allocation cycle' : 'Return Cycle', isIncomeProvider ? (quotation.incomeAllocation || "MONTHLY") : 'Annually'],
        ['Capital allocation', '100%'],
      ];

      summaryItems.forEach(([label, value]) => {
        if (label && value) {
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

      // Draw Table Headers
      const colWidths = isIncomeProvider ? [50, 150, 100, 150] : [50, 120, 100, 120, 100];
      const headers = isIncomeProvider 
        ? ['Year', 'Capital Value', 'Income Taken', 'Annual']
        : ['Year', 'Capital Value', 'Div Forecast', 'Projected Div', 'Annualised'];
      let xPos = margin;
      
      // Draw header row background
      page.drawRectangle({
        x: margin,
        y: y - 5,
        width: pageWidth - (margin * 2),
        height: lineHeight + 5,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      headers.forEach((header, i) => {
        page.drawText(header, { x: xPos + 5, y, size: 9, font: boldFont });
        xPos += colWidths[i];
      });
      y -= lineHeight + 5;

      // Current row
      xPos = margin;
      const currentValues = isIncomeProvider
        ? ['Current', `R ${boostedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, '-', '-']
        : [
          'Current', 
          `R ${quotation.investmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 
          `${quotation.interestRate}%`, 
          '-', 
          `R ${quotation.investmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        ];
      
      currentValues.forEach((val, i) => {
        page.drawRectangle({
          x: xPos,
          y: y - 5,
          width: colWidths[i],
          height: lineHeight + 5,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });
        page.drawText(val, { x: xPos + 5, y, size: 9, font });
        xPos += colWidths[i];
      });
      y -= lineHeight + 5;

      // Projections for each year up to the term
      let currentVal = boostedAmount;
      let totalIncome = 0;

      for (let i = 1; i <= Math.min(5, quotation.term); i++) {
        let rate = 0;
        if (isIncomeProvider) {
          if (quotation.term === 3) {
            rate = [10.25, 10.35, 10.45][i-1] || 10.45;
          } else {
            rate = [11.50, 11.60, 11.70, 11.80, 11.90][i-1] || 11.90;
          }
        } else {
          if (quotation.term === 1) {
            rate = Number(quotation.interestRate);
          } else if (quotation.term === 3) {
            rate = [11.75, 11.85, 11.95][i-1] || 11.95;
          } else {
            rate = [13.10, 13.20, 13.30, 13.40, 13.50][i-1] || 13.50;
          }
        }
        
        const divAmount = currentVal * (rate / 100);
        const annualised = isIncomeProvider ? currentVal : currentVal + divAmount;
        totalIncome += divAmount;
        
        xPos = margin;
        const rowValues: string[] = isIncomeProvider
          ? [
              `${i}`,
              `R ${currentVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              `${rate.toFixed(2)}%`,
              `R ${divAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            ]
          : [
              `${i}`,
              `R ${currentVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              `${rate.toFixed(2)}%`,
              `R ${divAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              `R ${annualised.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            ];

        rowValues.forEach((val, j) => {
          if (val) {
            page.drawRectangle({
              x: xPos,
              y: y - 5,
              width: colWidths[j],
              height: lineHeight + 5,
              borderColor: rgb(0, 0, 0),
              borderWidth: 1,
            });
            page.drawText(val, { x: xPos + 5, y, size: 9, font: (!isIncomeProvider && j === 4) ? boldFont : font });
          }
          xPos += colWidths[j];
        });
        
        currentVal = annualised;
        y -= lineHeight + 5;
      }

      if (isIncomeProvider) {
        y -= 10;
        page.drawText(`Growth Return Over Time: R ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, { x: margin + 200, y, size: 9, font: boldFont });
        y -= 15;
        page.drawText(`Capital Returned: R ${quotation.investmentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, { x: margin + 200, y, size: 9, font: boldFont });
      }
      y -= lineHeight * 2;

      // MODELLED FUND CHOICES Section
      page.drawText(`MODELLED FUND CHOICES`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;

      page.drawText(`ISIN`, { x: margin, y, size: 10, font: boldFont });
      page.drawText(`Fund Name`, { x: margin + 150, y, size: 10, font: boldFont });
      page.drawText(`Type`, { x: margin + 350, y, size: 10, font: boldFont });
      page.drawText(`Split`, { x: margin + 450, y, size: 10, font: boldFont });
      y -= lineHeight * 1.5;

      page.drawText(`ISIN Code GG00B3TBCS61`, { x: margin, y, size: 9, font });
      page.drawText(`WSF Global Equity Fund`, { x: margin + 150, y, size: 9, font });
      page.drawText(`Risk-Adverse`, { x: margin + 350, y, size: 9, font });
      page.drawText(`100%`, { x: margin + 450, y, size: 9, font });
      y -= lineHeight * 2;

      page.drawText(`* Please note that fund choices will be modeled and should the dividends below these returns,`, { x: margin, y, size: 8, font: italicFont });
      y -= 10;
      page.drawText(`the modeled returns will be payable to the client.`, { x: margin + 8, y, size: 8, font: italicFont });
      y -= lineHeight * 2;

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
        "10. The applicant retains the option to convert their capital to fixed shares at exit date; whereafter the par value of the converted shares will be based on a comprehensive company's valuation at the time of exit.",
        "11. This document serves as a formal proposal and is subject to full underwriting and approval by the management committee."
      ];

      conditions.forEach(condition => {
        const words = condition.split(' ');
        let currentLine = '';
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (font.widthOfTextAtSize(testLine, 9) > pageWidth - (margin * 2)) {
            if (y < 70) {
              page = doc.addPage();
              y = page.getSize().height - 50;
            }
            page.drawText(currentLine, { x: margin, y, size: 9, font });
            y -= 11;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        if (y < 70) {
          page = doc.addPage();
          y = page.getSize().height - 50;
        }
        page.drawText(currentLine, { x: margin, y, size: 9, font });
        y -= 15;
      });

      y -= lineHeight;

      // VALIDITY Section
      if (y < 100) {
        page = doc.addPage();
        y = page.getSize().height - 50;
      }
      page.drawText(`VALIDITY`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;
      const validityText = "This offer remains valid for a period of 14 days from the date of issuance, it is imperative that the receipt of funds occur within this specific time frame. All required documentation must be completed, and funds transfers finalized on or before expiration of the offers validity period. Should any information remain outstanding or incomplete, funds will be processed, a new offer must be issued and duly executed before the terms can be formally accepted by the company.";
      
      const wordsValidity = validityText.split(' ');
      let currentLineValidity = '';
      wordsValidity.forEach(word => {
        const testLine = currentLineValidity ? `${currentLineValidity} ${word}` : word;
        if (font.widthOfTextAtSize(testLine, 9) > pageWidth - (margin * 2)) {
          if (y < 70) {
            page = doc.addPage();
            y = page.getSize().height - 50;
          }
          page.drawText(currentLineValidity, { x: margin, y, size: 9, font });
          y -= 11;
          currentLineValidity = word;
        } else {
          currentLineValidity = testLine;
        }
      });
      if (y < 70) {
        page = doc.addPage();
        y = page.getSize().height - 50;
      }
      page.drawText(currentLineValidity, { x: margin, y, size: 9, font });
      y -= lineHeight * 3;

      // PLACEMENT AND ADMIN FEES
      if (y < 120) {
        page = doc.addPage();
        y = page.getSize().height - 50;
      }
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
      page.drawText(`Admin fees`, { x: margin, y, size: 10, font });
      page.drawText(`First 3 years`, { x: margin + 200, y, size: 10, font });
      page.drawText(`0.75% per annum`, { x: margin + 350, y, size: 10, font });
      y -= lineHeight;
      page.drawText(`Management Fees`, { x: margin, y, size: 10, font });
      page.drawText(`First 3 years`, { x: margin + 200, y, size: 10, font });
      page.drawText(`0.75% per annum`, { x: margin + 350, y, size: 10, font });
      y -= lineHeight * 2;

      // CLIENT SIGN Section - Validity, Taxation, Fees, Suitability, Financial Advice, Benefits on Death
      const clientSignContent = [
        { title: "Validity:", text: "This offer remains valid for a period of 14 days from the date of issuance. It is imperative that the receipt of funds occurs within this specific time frame. All required documentation must be completed, and funds transfers finalized, on or before the expiration of the offer's validity period. Should any information remain outstanding or incomplete, funds will be processed, but a new offer must be issued and duly executed before the terms can be formally accepted by the company." },
        { title: "Taxation:", text: "Taxation is not addressed in this plan. Taxation should be discussed with a tax adviser." },
        { title: "Fees:", text: "This offer details the fees payable under the contract, which encompass deal placement fees. (commissions)" },
        { title: "Suitability:", text: "The client's access to capital are restricted for the duration of this agreement. As such, it is imperative that the client maintains a financial position robust enough to support the terms and obligations outlined herein, such term also being the potential fluctuation of income drawn from the investment. Ensuring financial stability will safeguard the client's interest and and facilitate the successful execution of this agreement." },
        { title: "Financial Advice:", text: "Limited financial advice has been given with this offer." },
        { title: "Benefits payable on death:", text: "In the event of your passing during the term of this agreement, the benefits of this agreement shall be transferred to your designated beneficiaries or your estate until the end of the agreement." }
      ];

      page.drawText("CLIENT SIGN", { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;

      clientSignContent.forEach(section => {
        if (y < 80) {
          page = doc.addPage();
          y = page.getSize().height - 50;
        }
        page.drawText(section.title, { x: margin, y, size: 10, font: boldFont });
        y -= 12;
        
        const words = section.text.split(' ');
        let currentLine = '';
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (font.widthOfTextAtSize(testLine, 9) > pageWidth - (margin * 2)) {
            page.drawText(currentLine, { x: margin, y, size: 9, font });
            y -= 11;
            currentLine = word;
            if (y < 50) {
              page = doc.addPage();
              y = page.getSize().height - 50;
            }
          } else {
            currentLine = testLine;
          }
        });
        page.drawText(currentLine, { x: margin, y, size: 9, font });
        y -= 15;
      });

      y -= lineHeight;

      // COMMISSION
      if (y < 100) {
        page = doc.addPage();
        y = page.getSize().height - 50;
      }
      page.drawText(`COMMISSION`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;
      page.drawText(`Description`, { x: margin, y, size: 10, font: boldFont });
      page.drawText(`Frequency`, { x: margin + 200, y, size: 10, font: boldFont });
      page.drawText(`Percentage`, { x: margin + 350, y, size: 10, font: boldFont });
      y -= lineHeight * 1.2;
      page.drawText(`Commission`, { x: margin, y, size: 10, font });
      page.drawText(`First Year 1.00%`, { x: margin + 200, y, size: 10, font });
      page.drawText(`After 1st year 0.50% per annum`, { x: margin + 350, y, size: 10, font });
      y -= lineHeight * 2;

      // NEW SECTIONS
      const commissionInfo = "CLIENT SIGN\n\nValidity:\nThis offer remains valid for a period of 14 days from the date of issuance. It is imperative that the receipt of funds occurs within this specific time frame. All required documentation must be completed, and funds transfers finalized, on or before the expiration of the offer's validity period. Should any information remain outstanding or incomplete, funds will be processed, but a new offer must be issued and duly executed before the terms can be formally accepted by the company.\n\nTaxation:\nTaxation is not addressed in this plan. Taxation should be discussed with a tax adviser.\n\nFees:\nThis offer details the fees payable under the contract, which encompass deal placement fees. (commissions)\n\nSuitability:\nThe client's access to capital are restricted for the duration of this agreement. As such, it is imperative that the client maintains a financial position robust enough to support the terms and obligations outlined herein, such term also being the potential fluctuation of income drawn from the investment. Ensuring financial stability will safeguard the client's interest and facilitate the successful execution of this agreement.\n\nFinancial Advice:\nLimited financial advice has been given with this offer.\n\nBenefits payable on death:\nIn the event of your passing during the term of this agreement, the benefits of this agreement shall be transferred to your designated beneficiaries or your estate until the end of the agreement.";

      const commLines = commissionInfo.split('\n');
      commLines.forEach(line => {
        if (!line.trim()) {
          y -= lineHeight * 0.5;
          return;
        }
        const isHeader = line === "CLIENT SIGN" || line.endsWith(':');
        const fontSize = isHeader ? 10 : 9;
        const currentFont = isHeader ? boldFont : font;

        const words = line.split(' ');
        let currentLine = '';
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (currentFont.widthOfTextAtSize(testLine, fontSize) > pageWidth - (margin * 2)) {
            if (y < 70) {
              page = doc.addPage();
              y = page.getSize().height - 50;
            }
            page.drawText(currentLine, { x: margin, y, size: fontSize, font: currentFont });
            y -= fontSize + 2;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        if (y < 70) {
          page = doc.addPage();
          y = page.getSize().height - 50;
        }
        page.drawText(currentLine, { x: margin, y, size: fontSize, font: currentFont });
        y -= fontSize + 2;
      });
      y -= lineHeight;

      // NEW SECTIONS
      const sections = [
        {
          title: "CLIENT SIGN",
          text: "Validity:\nThis offer remains valid for a period of 14 days from the date of issuance. It is imperative that the receipt of funds occurs within this specific time frame. All required documentation must be completed, and funds transfers finalized, on or before the expiration of the offer's validity period. Should any information remain outstanding or incomplete, funds will be processed, but a new offer must be issued and duly executed before the terms can be formally accepted by the company.\n\nTaxation:\nTaxation is not addressed in this plan. Taxation should be discussed with a tax adviser.\n\nFees:\nThis offer details the fees payable under the contract, which encompass deal placement fees. (commissions)\n\nSuitability:\nThe client's access to capital are restricted for the duration of this agreement. As such, it is imperative that the client maintains a financial position robust enough to support the terms and obligations outlined herein, such term also being the potential fluctuation of income drawn from the investment. Ensuring financial stability will safeguard the client's interest and facilitate the successful execution of this agreement.\n\nFinancial Advice:\nLimited financial advice has been given with this offer.\n\nBenefits payable on death:\nIn the event of your passing during the term of this agreement, the benefits of this agreement shall be transferred to your designated beneficiaries or your estate until the end of the agreement."
        }
      ];

      sections.forEach(section => {
        if (y < 100) {
          page = doc.addPage();
          y = page.getSize().height - 50;
        }
        page.drawText(section.title, { x: margin, y, size: 11, font: boldFont });
        y -= lineHeight * 1.5;

        const lines = section.text.split('\n');
        lines.forEach(line => {
          if (!line.trim()) {
            y -= lineHeight * 0.5;
            return;
          }
          const words = line.split(' ');
          let currentLine = '';
          words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (font.widthOfTextAtSize(testLine, 9) > width - (margin * 2)) {
              if (y < 70) {
                page = doc.addPage();
                y = page.getSize().height - 50;
              }
              page.drawText(currentLine, { x: margin, y, size: 9, font });
              y -= 11;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          });
          if (y < 70) {
            page = doc.addPage();
            y = page.getSize().height - 50;
          }
          page.drawText(currentLine, { x: margin, y, size: 9, font });
          y -= 11;
        });
        y -= lineHeight;
      });

      y -= lineHeight;

      // AGREEMENT DETAILS
      if (y < 150) {
        page = doc.addPage();
        y = page.getSize().height - 50;
      }
      page.drawText(`AGREEMENT DETAILS`, { x: margin, y, size: 11, font: boldFont });
      y -= lineHeight * 1.5;
      page.drawText(`Agreement number:`, { x: margin, y, size: 10, font });
      page.drawText(`OFDN-104-778-003`, { x: margin + 150, y, size: 10, font: boldFont });
      page.drawText(`Elroy Meiring`, { x: margin + 350, y, size: 10, font: boldFont });
      y -= lineHeight;
      page.drawText(`Investor Name:`, { x: margin, y, size: 10, font });
      page.drawText(`${quotation.clientName}`, { x: margin + 150, y, size: 10, font });
      y -= lineHeight * 2;

      const acceptanceText = "I, the undersigned, by my signature below, hereby accept the above quotation and confirm that this quotation will form the basis of my agreement with the company. I confirm that the amount will be invested and I confirm herewith by my signature below that this will constitute a legal, valid and binding obligation to the issuer enforceable in accordance with its terms.";
      const wordsAcceptance = acceptanceText.split(' ');
      let currentLineAcceptance = '';
      wordsAcceptance.forEach(word => {
        const testLine = currentLineAcceptance ? `${currentLineAcceptance} ${word}` : word;
        if (font.widthOfTextAtSize(testLine, 9) > pageWidth - (margin * 2)) {
          page.drawText(currentLineAcceptance, { x: margin, y, size: 9, font });
          y -= 11;
          currentLineAcceptance = word;
        } else {
          currentLineAcceptance = testLine;
        }
      });
      page.drawText(currentLineAcceptance, { x: margin, y, size: 9, font });
      y -= lineHeight * 3;

      page.drawText(`Signature of Investor: ________________________`, { x: margin, y, size: 10, font: boldFont });
      y -= lineHeight * 4;

      // Prepared By section
      page.drawText(`Offer Prepared By:`, { x: margin, y, size: 10, font: boldFont });
      y -= lineHeight;
      page.drawText(`${quotation.preparedByName || 'Lionel Lottering'}`, { x: margin, y, size: 10, font });
      y -= lineHeight;
      page.drawText(`Cell: ${quotation.preparedByCell || '076 309 2590'}`, { x: margin, y, size: 10, font });
      y -= lineHeight;
      page.drawText(`Office: ${quotation.preparedByOffice || '0861 263 346'}`, { x: margin, y, size: 10, font });
      y -= lineHeight;
      page.drawText(`Email: ${quotation.preparedByEmail || 'lionell@opianfsgroup.com'}`, { x: margin, y, size: 10, font });

      y -= lineHeight * 2;

      // CLIENT SIGN Section
      const clientSignSections = [
        {
          title: "CLIENT SIGN",
          text: "Validity:\nThis offer remains valid for a period of 14 days from the date of issuance. It is imperative that the receipt of funds occurs within this specific time frame. All required documentation must be completed, and funds transfers finalized, on or before the expiration of the offer's validity period. Should any information remain outstanding or incomplete, funds will be processed, but a new offer must be issued and duly executed before the terms can be formally accepted by the company.\n\nTaxation:\nTaxation is not addressed in this plan. Taxation should be discussed with a tax adviser.\n\nFees:\nThis offer details the fees payable under the contract, which encompass deal placement fees. (commissions)\n\nSuitability:\nThe client's access to capital are restricted for the duration of this agreement. As such, it is imperative that the client maintains a financial position robust enough to support the terms and obligations outlined herein, such term also being the potential fluctuation of income drawn from the investment. Ensuring financial stability will safeguard the client's interest and facilitate the successful execution of this agreement.\n\nFinancial Advice:\nLimited financial advice has been given with this offer.\n\nBenefits payable on death:\nIn the event of your passing during the term of this agreement, the benefits of this agreement shall be transferred to your designated beneficiaries or your estate until the end of the agreement."
        }
      ];

      clientSignSections.forEach(section => {
        if (y < 100) {
          page = doc.addPage();
          y = page.getSize().height - 50;
        }
        page.drawText(section.title, { x: margin, y, size: 11, font: boldFont });
        y -= lineHeight * 1.5;

        const lines = section.text.split('\n');
        lines.forEach(line => {
          if (!line.trim()) {
            y -= lineHeight * 0.5;
            return;
          }
          const words = line.split(' ');
          let currentLine = '';
          words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (font.widthOfTextAtSize(testLine, 9) > width - (margin * 2)) {
              if (y < 70) {
                page = doc.addPage();
                y = page.getSize().height - 50;
              }
              page.drawText(currentLine, { x: margin, y, size: 9, font });
              y -= 11;
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          });
          if (y < 70) {
            page = doc.addPage();
            y = page.getSize().height - 50;
          }
          page.drawText(currentLine, { x: margin, y, size: 9, font });
          y -= 11;
        });
        y -= lineHeight;
      });

      page.drawText(`Signature of investor: _________________________________`, { x: margin, y, size: 10, font });
      y -= lineHeight * 3;

      // SUPPORT DOCUMENTATION
      if (y < 100) {
        page = doc.addPage();
        y = page.getSize().height - 50;
      }
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
        console.error("Validation failed:", result.error.issues);
        return res.status(400).json({ message: "Invalid quotation data", errors: result.error.issues });
      }
      const quotationData = { 
        ...result.data, 
        userId: req.user.id,
        calculationDate: result.data.calculationDate ? new Date(result.data.calculationDate) : undefined,
        commencementDate: result.data.commencementDate ? new Date(result.data.commencementDate) : undefined,
        redemptionDate: result.data.redemptionDate ? new Date(result.data.redemptionDate) : undefined,
        interestRate: result.data.interestRate?.toString() || "0", 
        maturityValue: Math.round(Number(result.data.maturityValue) || 0), 
        investmentAmount: Math.round(Number(result.data.investmentAmount) || 0),
        investmentBooster: Math.round(Number(result.data.investmentBooster) || 0),
        yearlyDivAllocation: Math.round((Number(result.data.yearlyDivAllocation) || 9.75) * 100), // Store as integer basis points
        type: result.data.type || "capital_appreciator",
        incomeAllocation: result.data.incomeAllocation || null,
      };
      const quotation = await storage.createCdnQuotation(quotationData as any);
      res.status(201).json(quotation);
    } catch (error) {
      console.error("Quotation creation error:", error);
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

      const client = await storage.getClient(quotation.clientId!);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // === PDF Setup ===
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const leftMargin = 72; // 1 inch margin
      const rightMargin = 72;
      const pageWidth = 595.28;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      // Load logo images
      let opianLogo: any = null;
      let flexMaxLogo: any = null;
      try {
        const opianLogoPath = path.join(__dirname, "../attached_assets/image_1770362658653.png");
        const flexMaxLogoPath = path.join(__dirname, "../attached_assets/image_1770362682173.png");
        
        const opianLogoBytes = await fs.promises.readFile(opianLogoPath);
        const flexMaxLogoBytes = await fs.promises.readFile(flexMaxLogoPath);
        
        opianLogo = await pdfDoc.embedPng(opianLogoBytes);
        flexMaxLogo = await pdfDoc.embedPng(flexMaxLogoBytes);
      } catch (error) {
        console.warn("Could not load logo images:", error);
      }

      // === Helper Functions ===
      const addLogos = (page: any) => {
        if (opianLogo) {
          const logoWidth = 150;
          const logoHeight = 45;
          page.drawImage(opianLogo, {
            x: leftMargin,
            y: 780,
            width: logoWidth,
            height: logoHeight
          });
        }
        if (flexMaxLogo) {
          const logoWidth = 140;
          const logoHeight = 35;
          page.drawImage(flexMaxLogo, {
            x: pageWidth - rightMargin - logoWidth,
            y: 785,
            width: logoWidth,
            height: logoHeight
          });
        }
      };

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

      // === Calculations ===
      const targetValue = quotation.investmentAmount * (1 + (Number(quotation.interestRate) || 0) / 100);
      const totalProfit = targetValue - quotation.investmentAmount;
      const sharesIssued = quotation.investmentAmount / 8;
      // Using maturityValue and other fields from quotation if available, otherwise defaulting to 0
      const year1Return = sharesIssued * (quotation.yearlyDivAllocation || 0);
      const year2Return = sharesIssued * (quotation.yearlyDivAllocation || 0);
      const year3Return = sharesIssued * (quotation.yearlyDivAllocation || 0);
      const year4Return = sharesIssued * (quotation.yearlyDivAllocation || 0);
      const year5Return = sharesIssued * (quotation.yearlyDivAllocation || 0);

      const year1Value = quotation.investmentAmount + year1Return;
      const year2Value = year1Value + year2Return;
      const year3Value = year2Value + year3Return;
      const year4Value = year3Value + year4Return;
      const year5Value = year4Value + year5Return;

      const term = Number(quotation.term) || 1;
      const annualizedReturn = Math.pow(targetValue / quotation.investmentAmount, 1 / term) - 1;

      // === COVER PAGE ===
      const coverPage = pdfDoc.addPage([595.28, 841.89]);
      
      
      // Add logo on the left side - larger for cover
      if (opianLogo) {
        const logoWidth = 200;
        const logoHeight = 58;
        const logoX = 60;
        const logoY = 650;
        
        coverPage.drawImage(opianLogo, {
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
      addLogos(page1);
      let yPos = 680;

      // Title with dynamic values
      const pageTitle = `Quotation for FlexMax Capital Appreciator Fixed Deposit Note ${quotation.term} Year Term`;
      page1.drawText(pageTitle, { 
        x: leftMargin, 
        y: yPos, 
        size: 14, 
        font: boldFont 
      });

      yPos -= 40;

      // Header Info
      page1.drawText(`Date of Offer:`, { x: leftMargin, y: yPos, size: 10, font });
      page1.drawText(`${format(new Date(quotation.calculationDate), 'yyyy/MM/dd')}`, { x: leftMargin + 150, y: yPos, size: 10, font });
      yPos -= 20;

      // Client information
      page1.drawText("Offered to:", { x: leftMargin, y: yPos, size: 10, font });
      page1.drawText(quotation.clientName, { x: leftMargin + 150, y: yPos, size: 10, font });
      yPos -= 20;

      page1.drawText("Address:", { x: leftMargin, y: yPos, size: 10, font });
      const addressLines = quotation.clientAddress.split("\n");
      addressLines.forEach((line, i) => {
        if (line.trim()) {
          page1.drawText(line, { x: leftMargin + 150, y: yPos, size: 10, font });
          yPos -= 15;
        }
      });

      page1.drawText(`Telephone:`, { x: leftMargin, y: yPos, size: 10, font });
      page1.drawText(`${quotation.clientPhone || ""}`, { x: leftMargin + 150, y: yPos, size: 10, font });
      yPos -= 15;
      page1.drawText(`Email:`, { x: leftMargin, y: yPos, size: 10, font });
      page1.drawText(`${client.email || ""}`, { x: leftMargin + 150, y: yPos, size: 10, font });
      yPos -= 30;

      // CLIENT SIGN section for page1
      const clientSignInfo = "CLIENT SIGN\n\nValidity:\nThis offer remains valid for a period of 14 days from the date of issuance. It is imperative that the receipt of funds occurs within this specific time frame. All required documentation must be completed, and funds transfers finalized, on or before the expiration of the offer's validity period. Should any information remain outstanding or incomplete, funds will be processed, but a new offer must be issued and duly executed before the terms can be formally accepted by the company.\n\nTaxation:\nTaxation is not addressed in this plan. Taxation should be discussed with a tax adviser.\n\nFees:\nThis offer details the fees payable under the contract, which encompass deal placement fees. (commissions)\n\nSuitability:\nThe client's access to capital are restricted for the duration of this agreement. As such, it is imperative that the client maintains a financial position robust enough to support the terms and obligations outlined herein, such term also being the potential fluctuation of income drawn from the investment. Ensuring financial stability will safeguard the client's interest and facilitate the successful execution of this agreement.\n\nFinancial Advice:\nLimited financial advice has been given with this offer.\n\nBenefits payable on death:\nIn the event of your passing during the term of this agreement, the benefits of this agreement shall be transferred to your designated beneficiaries or your estate until the end of the agreement.";

      const csLines = clientSignInfo.split('\n');
      csLines.forEach(line => {
        if (!line.trim()) {
          yPos -= 10;
          return;
        }
        const isHeader = line === "CLIENT SIGN" || line.endsWith(':');
        const fontSize = isHeader ? 10 : 9;
        const currentFont = isHeader ? boldFont : font;

        const words = line.split(' ');
        let currentLine = '';
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (currentFont.widthOfTextAtSize(testLine, fontSize) > contentWidth) {
            if (yPos < 70) {
              page1 = pdfDoc.addPage([595.28, 841.89]);
              addFooter(page1);
              addLogos(page1);
              yPos = 750;
            }
            page1.drawText(currentLine, { x: leftMargin, y: yPos, size: fontSize, font: currentFont });
            yPos -= fontSize + 2;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        if (yPos < 70) {
          page1 = pdfDoc.addPage([595.28, 841.89]);
          addFooter(page1);
          addLogos(page1);
          yPos = 750;
        }
        page1.drawText(currentLine, { x: leftMargin, y: yPos, size: fontSize, font: currentFont });
        yPos -= fontSize + 2;
      });
      yPos -= 20;

      page1.drawText(`Dear ${quotation.clientName}`, { x: leftMargin, y: yPos, size: 11, font });

      yPos -= 20;
      page1.drawText("We take pleasure in submitting the following proposal to you:", { 
        x: leftMargin, 
        y: yPos, 
        size: 11, 
        font 
      });

      yPos -= 40;

      // INVESTMENT SUMMARY Section
      page1.drawText("INVESTMENT SUMMARY", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;

      const boostedAmount = quotation.investmentAmount * (1 + (quotation.investmentBooster || 0) / 100);
      const firstYearRate = quotation.term === 1 ? quotation.interestRate : (quotation.term === 3 ? "11.75%" : "13.10%");

      const summaryData = [
        ["Investment amount", `R ${quotation.investmentAmount.toLocaleString()}`],
        ["Investment Booster", `${quotation.investmentBooster || 0}%`],
        ["Amount allocated with enhancement", `R ${boostedAmount.toLocaleString()}`],
        ["Term in years", `${quotation.term}`],
        ["Commencement date", `${format(new Date(quotation.commencementDate), 'dd-MMM-yy')}`],
        ["Percentage returned first year", `${firstYearRate}%`],
        ["Income allocated to capital in first year", `R ${(boostedAmount * (parseFloat(firstYearRate) / 100)).toLocaleString()}`],
        ["Liquidity", "None"],
        ["Contract Start date", `${format(new Date(quotation.commencementDate), 'dd-MMM-yy')}`],
        ["Exit date", `${format(new Date(quotation.redemptionDate), 'dd-MMM-yy')}`],
        ["Return Cycle", "Annually"],
        ["Capital allocation", "100%"]
      ];

      summaryData.forEach(([label, value]) => {
        page1.drawText(label, { x: leftMargin, y: yPos, size: 10, font });
        page1.drawText(value, { x: leftMargin + 250, y: yPos, size: 10, font });
        yPos -= 17;
      });

      yPos -= 30;

      // === PAGE 2: INCOME PROJECTIONS ===
      const page2 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page2);
      addLogos(page2);
      yPos = 750;

      page2.drawText("INCOME PROJECTIONS", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 30;

      const projColWidths = [50, 120, 100, 120, 100];
      const projHeaders = ['Year', 'Capital Value', 'Div Forecast', 'Projected Div', 'Annualised'];
      let projX = leftMargin;
      
      page2.drawRectangle({
        x: leftMargin,
        y: yPos - 5,
        width: contentWidth,
        height: 20,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });

      projHeaders.forEach((header, i) => {
        page2.drawText(header, { x: projX + 5, y: yPos, size: 9, font: boldFont });
        projX += projColWidths[i];
      });
      yPos -= 20;

      // Projections logic
      let currentVal = boostedAmount;
      const yearlyDivAllocation = quotation.term === 1 ? Number(quotation.interestRate) : (quotation.term === 3 ? 11.75 : 13.10);

      for (let i = 1; i <= Math.min(5, quotation.term); i++) {
        let rate = yearlyDivAllocation;
        if (quotation.term === 3) {
          rate = [11.75, 11.85, 11.95][i-1] || 11.95;
        } else if (quotation.term === 5) {
          rate = [13.10, 13.20, 13.30, 13.40, 13.50][i-1] || 13.50;
        }
        
        const divAmount = currentVal * (rate / 100);
        const annualised = currentVal + divAmount;
        
        projX = leftMargin;
        const rowValues = [
          `${i}`,
          `R ${currentVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `${rate.toFixed(2)}%`,
          `R ${divAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          `R ${annualised.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        ];

        rowValues.forEach((val, j) => {
          page2.drawRectangle({
            x: projX,
            y: yPos - 5,
            width: projColWidths[j],
            height: 20,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
          });
          page2.drawText(val, { x: projX + 5, y: yPos, size: 9, font: j === 4 ? boldFont : font });
          projX += projColWidths[j];
        });
        
        currentVal = annualised;
        yPos -= 20;
      }

      yPos -= 40;

      // CONDITIONS Section
      page2.drawText("CONDITIONS", { x: leftMargin, y: yPos, size: 12, font: boldFont });
      yPos -= 25;

      const conditions = [
        "1. To effectively evaluate this product against comparable alternatives, it is essential to analyze and contrast its risk-reward profile with those of similar products offering analogous risk-reward structures.",
        "2. This offer involves the purchase of Fixed Deposit Notes (FDN's) in private equity. Given the inherent risks associated we strongly recommend independent advice before making any commitment.",
        "3. This offer contains no guarantees beyond those expressly stated herein. Upon signing, the terms outlined in this offer shall constitute a legally binding agreement between the client and the company.",
        "4. The applicant acknowledges understanding of the complexities involving this investment as well as the lock-in periods contained in the investment.",
        "5. The applicant understands that a loan agreement will come into existence after signature of this quotation and that returns paid are mirrored on the performance of the selected fund above.",
        "6. The applicant understands the zero liquidity nature of this investment and has ensured that he has enough liquid investments or savings to ensure liquidity during this investment.",
        "7. The applicant understands that the directors or trustees of company funds, in their collective capacity, may limit, withhold, defer or reduce payments or payouts as necessary at moment's notice to safeguard the company's liquidity requirements and ensure financial stability.",
        "8. The individual, individuals or organisation's entering into this agreement acknowledges and understands that this is a fixed-term contract, as specified in the duration outlined above. The term \"Exit Date\" refers to the agreed-upon end date of the agreement.",
        "9. The applicant understands that if shares are issued under this agreement, the shares are issued for security only and are returnable when the applicant is paid back his invested capital.",
        "10. The applicant retains the option to convert their capital to fixed shares at exit date; whereafter the par value of the converted shares will be based on a comprehensive company's valuation at the time of exit."
      ];

      conditions.forEach(condition => {
        yPos = drawJustifiedText(page2, condition, leftMargin, yPos, contentWidth, font, 9, 13);
        yPos -= 5;
      });

      // === PAGE 3: ADDITIONAL INFO ===
      const page3 = pdfDoc.addPage([595.28, 841.89]);
      addFooter(page3);
      addLogos(page3);
      yPos = 750;

      // Validity
      page3.drawText("VALIDITY", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 20;
      const validityText = "This offer remains valid for a period of 14 days from the date of issuance. It is imperative that the receipt of funds occurs within this specific time frame. All required documentation must be completed, and funds transfers finalized, on or before expiration of the offer's validity period. Should any information remain outstanding or incomplete, funds will be processed, a new offer must be issued and duly executed before the terms can be formally accepted by the company.";
      yPos = drawJustifiedText(page3, validityText, leftMargin, yPos, contentWidth, font, 10, 15);
      yPos -= 20;

      // Taxation
      page3.drawText("Taxation:", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 20;
      page3.drawText("Taxation is not addressed in this plan. Taxation should be discussed with a tax adviser.", { x: leftMargin, y: yPos, size: 10, font });
      yPos -= 30;

      // Fees
      page3.drawText("Fees:", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 20;
      page3.drawText("This offer details the fees payable under the contract, which encompass deal placement fees. (commissions)", { x: leftMargin, y: yPos, size: 10, font });
      yPos -= 30;

      // Suitability
      page3.drawText("Suitability:", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 20;
      const suitabilityText = "The client's access to capital are restricted for the duration of this agreement. As such, it is imperative that the client maintains a financial position robust enough to support the terms and obligations outlined herein, such term also being the potential fluctuation of income drawn from the investment. Ensuring financial stability will safeguard the client's interest and and facilitate the successful execution of this agreement.";
      yPos = drawJustifiedText(page3, suitabilityText, leftMargin, yPos, contentWidth, font, 10, 15);
      yPos -= 40;

      // PLACEMENT AND ADMIN FEES
      if (yPos < 120) {
        page3 = pdfDoc.addPage([595.28, 841.89]);
        addFooter(page3);
        addLogos(page3);
        yPos = 750;
      }
      page3.drawText(`PLACEMENT AND ADMIN FEES`, { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 15 * 1.5;
      
      const feeTable = [
        ["Placement fee", "Once Off", "1.00% once off"],
        ["Admin Fees", "Once Off", "3.50%"]
      ];

      feeTable.forEach(([desc, freq, pct]) => {
        page3.drawRectangle({ x: leftMargin, y: yPos - 5, width: contentWidth, height: 20, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });
        page3.drawText(desc, { x: leftMargin + 5, y: yPos, size: 10, font });
        page3.drawText(freq, { x: leftMargin + 200, y: yPos, size: 10, font });
        page3.drawText(pct, { x: leftMargin + 350, y: yPos, size: 10, font });
        yPos -= 20;
      });

      yPos -= 30;

      // CLIENT SIGN Section - Validity, Taxation, Fees, Suitability, Financial Advice, Benefits on Death
      const clientSignContentPost = [
        { title: "Validity:", text: "This offer remains valid for a period of 14 days from the date of issuance. It is imperative that the receipt of funds occurs within this specific time frame. All required documentation must be completed, and funds transfers finalized, on or before the expiration of the offer's validity period. Should any information remain outstanding or incomplete, funds will be processed, but a new offer must be issued and duly executed before the terms can be formally accepted by the company." },
        { title: "Taxation:", text: "Taxation is not addressed in this plan. Taxation should be discussed with a tax adviser." },
        { title: "Fees:", text: "This offer details the fees payable under the contract, which encompass deal placement fees. (commissions)" },
        { title: "Suitability:", text: "The client's access to capital are restricted for the duration of this agreement. As such, it is imperative that the client maintains a financial position robust enough to support the terms and obligations outlined herein, such term also being the potential fluctuation of income drawn from the investment. Ensuring financial stability will safeguard the client's interest and and facilitate the successful execution of this agreement." },
        { title: "Financial Advice:", text: "Limited financial advice has been given with this offer." },
        { title: "Benefits payable on death:", text: "In the event of your passing during the term of this agreement, the benefits of this agreement shall be transferred to your designated beneficiaries or your estate until the end of the agreement." }
      ];

      page3.drawText("CLIENT SIGN", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 15 * 1.5;

      clientSignContentPost.forEach(section => {
        if (yPos < 100) {
          page3 = pdfDoc.addPage([595.28, 841.89]);
          addFooter(page3);
          addLogos(page3);
          yPos = 750;
        }
        page3.drawText(section.title, { x: leftMargin, y: yPos, size: 10, font: boldFont });
        yPos -= 12;
        
        yPos = drawJustifiedText(page3, section.text, leftMargin, yPos, contentWidth, font, 9, 13);
        yPos -= 10;
      });

      yPos -= 20;

      yPos -= 30;
      page3.drawText("Commission", { x: leftMargin, y: yPos, size: 11, font: boldFont });
      yPos -= 20;
      page3.drawRectangle({ x: leftMargin, y: yPos - 5, width: contentWidth, height: 20, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });
      page3.drawText("Commission", { x: leftMargin + 5, y: yPos, size: 10, font });
      page3.drawText("First Year 0.50%", { x: leftMargin + 200, y: yPos, size: 10, font });
      page3.drawText("0.50%", { x: leftMargin + 350, y: yPos, size: 10, font });
      yPos -= 40;

      // Agreement Details and Checklist
      page3.drawText(`Agreement number: OFDN-104-778-004`, { x: leftMargin, y: yPos, size: 10, font: boldFont });
      page3.drawText(quotation.clientName, { x: leftMargin + 250, y: yPos, size: 10, font: boldFont });
      yPos -= 40;

      page3.drawText("Signature of Investor: _________________________________", { x: leftMargin, y: yPos, size: 10, font });
      yPos -= 40;

      page3.drawText("PLEASE ATTACH THE FOLLOWING SUPPORT DOCUMENTATION:", { x: leftMargin, y: yPos, size: 10, font: boldFont });
      yPos -= 25;

      const checklist = ["Application form", "Copy of Identity Document / Passport", "Proof of Address", "Bank Statement"];
      checklist.forEach(item => {
        page3.drawRectangle({ x: leftMargin + 250, y: yPos - 2, width: 15, height: 15, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        page3.drawText(item, { x: leftMargin, y: yPos, size: 10, font });
        yPos -= 20;
      });


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