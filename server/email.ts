import nodemailer from 'nodemailer';

interface AppointmentEmailData {
  clientName: string;
  clientEmail: string;
  appointmentTitle: string;
  appointmentDate: string;
  appointmentTime: string;
  teamMemberName: string;
  teamMemberEmail: string;
  description?: string;
}

// Create reusable transporter object using environment variables
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendAppointmentConfirmation = async (data: AppointmentEmailData) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('Email configuration not found, skipping email notification');
    return;
  }

  const transporter = createTransporter();

  // Email to client
  const clientMailOptions = {
    from: `"Opian Core" <${process.env.SMTP_USER}>`,
    to: data.clientEmail,
    subject: `Appointment Confirmation - ${data.appointmentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Appointment Confirmed</h2>
        <p>Dear ${data.clientName},</p>
        <p>Your appointment has been successfully scheduled with our team.</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e293b;">Appointment Details</h3>
          <p><strong>Title:</strong> ${data.appointmentTitle}</p>
          <p><strong>Date:</strong> ${data.appointmentDate}</p>
          <p><strong>Time:</strong> ${data.appointmentTime}</p>
          <p><strong>Assigned to:</strong> ${data.teamMemberName}</p>
          ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
        </div>
        
        <p>If you need to reschedule or have any questions, please contact us.</p>
        <p>Best regards,<br>The Opian Core Team</p>
      </div>
    `,
  };

  // Email to team member
  const teamMemberMailOptions = {
    from: `"Opian Core" <${process.env.SMTP_USER}>`,
    to: data.teamMemberEmail,
    subject: `New Appointment Assigned - ${data.appointmentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Appointment Assignment</h2>
        <p>Hello ${data.teamMemberName},</p>
        <p>You have been assigned a new appointment.</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e293b;">Appointment Details</h3>
          <p><strong>Title:</strong> ${data.appointmentTitle}</p>
          <p><strong>Date:</strong> ${data.appointmentDate}</p>
          <p><strong>Time:</strong> ${data.appointmentTime}</p>
          <p><strong>Client:</strong> ${data.clientName}</p>
          <p><strong>Client Email:</strong> ${data.clientEmail}</p>
          ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
        </div>
        
        <p>Please ensure you're prepared for this appointment.</p>
        <p>Best regards,<br>Opian Core System</p>
      </div>
    `,
  };

  try {
    // Send emails concurrently
    await Promise.all([
      transporter.sendMail(clientMailOptions),
      transporter.sendMail(teamMemberMailOptions),
    ]);
    
    console.log('Appointment confirmation emails sent successfully');
  } catch (error) {
    console.error('Error sending appointment emails:', error);
    throw error;
  }
};

export const sendCdnQuotationEmail = async (data: {
  clientName: string;
  clientEmail: string;
  amount: number;
  rate: number;
  maturity: number;
}) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('Email configuration not found, skipping email notification');
    return;
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: `"Opian Core" <${process.env.SMTP_USER}>`,
    to: data.clientEmail,
    subject: `Capital Deposit Note Quotation`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Investment Quotation</h2>
        <p>Dear ${data.clientName},</p>
        <p>Please find your Capital Deposit Note quotation details below:</p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e293b;">Quotation Details</h3>
          <p><strong>Investment Amount:</strong> $${data.amount.toLocaleString()}</p>
          <p><strong>Interest Rate:</strong> ${data.rate}%</p>
          <p><strong>Term:</strong> 1 Year</p>
          <p><strong>Maturity Value:</strong> $${data.maturity.toLocaleString()}</p>
        </div>
        
        <p>Best regards,<br>The Opian Core Team</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendAppointmentUpdate = async (data: AppointmentEmailData & { isUpdate: boolean }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('Email configuration not found, skipping email notification');
    return;
  }

  const transporter = createTransporter();
  const subject = data.isUpdate ? 'Appointment Updated' : 'Appointment Cancelled';

  // Email to client
  const clientMailOptions = {
    from: `"Opian Core" <${process.env.SMTP_USER}>`,
    to: data.clientEmail,
    subject: `${subject} - ${data.appointmentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${subject}</h2>
        <p>Dear ${data.clientName},</p>
        <p>Your appointment has been ${data.isUpdate ? 'updated' : 'cancelled'}.</p>
        
        ${data.isUpdate ? `
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e293b;">Updated Appointment Details</h3>
          <p><strong>Title:</strong> ${data.appointmentTitle}</p>
          <p><strong>Date:</strong> ${data.appointmentDate}</p>
          <p><strong>Time:</strong> ${data.appointmentTime}</p>
          <p><strong>Assigned to:</strong> ${data.teamMemberName}</p>
          ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
        </div>
        ` : ''}
        
        <p>If you have any questions, please contact us.</p>
        <p>Best regards,<br>The Opian Core Team</p>
      </div>
    `,
  };

  // Email to team member
  const teamMemberMailOptions = {
    from: `"Opian Core" <${process.env.SMTP_USER}>`,
    to: data.teamMemberEmail,
    subject: `${subject} - ${data.appointmentTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${subject}</h2>
        <p>Hello ${data.teamMemberName},</p>
        <p>An appointment has been ${data.isUpdate ? 'updated' : 'cancelled'}.</p>
        
        ${data.isUpdate ? `
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e293b;">Updated Appointment Details</h3>
          <p><strong>Title:</strong> ${data.appointmentTitle}</p>
          <p><strong>Date:</strong> ${data.appointmentDate}</p>
          <p><strong>Time:</strong> ${data.appointmentTime}</p>
          <p><strong>Client:</strong> ${data.clientName}</p>
          <p><strong>Client Email:</strong> ${data.clientEmail}</p>
          ${data.description ? `<p><strong>Description:</strong> ${data.description}</p>` : ''}
        </div>
        ` : ''}
        
        <p>Best regards,<br>Opian Core System</p>
      </div>
    `,
  };

  try {
    await Promise.all([
      transporter.sendMail(clientMailOptions),
      transporter.sendMail(teamMemberMailOptions),
    ]);
    
    console.log(`Appointment ${data.isUpdate ? 'update' : 'cancellation'} emails sent successfully`);
  } catch (error) {
    console.error(`Error sending appointment ${data.isUpdate ? 'update' : 'cancellation'} emails:`, error);
    throw error;
  }
};