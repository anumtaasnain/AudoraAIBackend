const nodemailer = require('nodemailer');

// For development, we'll use a mock or ethereal account
// In production, use your SMTP credentials
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER || 'mock_user',
    pass: process.env.SMTP_PASS || 'mock_pass',
  },
});

exports.sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: '"Audora AI" <notifications@audoraai.com>',
      to,
      subject,
      text,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${subject}`);
    return info;
  } catch (err) {
    console.error('❌ Email failed:', err);
    // Don't throw, just log so the main app flow isn't broken
  }
};

exports.templates = {
  paymentSuccess: (organizerEmail, amount, leads) => ({
    subject: 'Payment Successful - Leads Provisioned!',
    text: `Hi, your payment of $${amount} for ${leads} leads was successful. Check your dashboard!`,
    html: `<h1>Payment Confirmed</h1><p>Hi, your payment of <b>$${amount}</b> for <b>${leads} leads</b> was successful. The matching attendees have been added to your event registrations.</p>`,
  }),
  leadRequestReceived: (organizerEmail, eventTitle, leadCount, amount) => ({
    subject: 'Your Lead Request Has Been Received',
    text: `Hi, your lead request for "${eventTitle}" (${leadCount} leads, $${amount}) is pending admin review.`,
    html: `<h1>Lead Request Received</h1><p>Thank you! Your request for <b>${leadCount} leads</b> for the event <b>${eventTitle}</b> (Total: $${amount}) has been received and is now pending admin review.</p><p>You will receive a notification once your leads have been assigned.</p>`,
  }),
  leadRequestAssigned: (organizerEmail, eventTitle, leadCount, amount) => ({
    subject: 'Your Leads Have Been Assigned',
    text: `Hi, ${leadCount} leads have been assigned to your event "${eventTitle}". Visit your dashboard to view the full profiles.`,
    html: `<h1>✅ Leads Assigned!</h1><p>Good news! <b>${leadCount} high-profile leads</b> have been assigned to your event <b>${eventTitle}</b>.</p><p>Total value: <b>$${amount}</b></p><p>Visit your dashboard to view the complete lead list with contact details.</p>`,
  }),
  sponsorshipPitch: (sponsorEmail, eventTitle, organizerEmail) => ({
    subject: `New Sponsorship Opportunity: ${eventTitle}`,
    text: `Hi, an organizer (${organizerEmail}) has pitched their event "${eventTitle}" to you.`,
    html: `<h1>New Sponsorship Pitch</h1><p>The organizer <b>${organizerEmail}</b> wants to connect with you for their event: <b>${eventTitle}</b>.</p><p>Check your Sponsorships dashboard to review the proposal.</p>`,
  }),
  sponsorshipStatus: (organizerEmail, eventTitle, status) => ({
    subject: `Sponsorship Update: ${eventTitle}`,
    text: `Your sponsorship request for "${eventTitle}" has been ${status}.`,
    html: `<h1>Sponsorship Update</h1><p>Your request for the event <b>${eventTitle}</b> has been <b>${status}</b>.</p>`,
  }),
  reminder: (attendeeEmail, eventTitle, days) => ({
    subject: `Reminder: ${eventTitle} is starting ${days === 0 ? 'today!' : 'tomorrow!'}`,
    text: `Don't forget, ${eventTitle} starts ${days === 0 ? 'today' : 'tomorrow'}.`,
    html: `<h1>Event Reminder</h1><p>Hi, just a reminder that <b>${eventTitle}</b> starts <b>${days === 0 ? 'today' : 'tomorrow'}</b>.</p><p>We look forward to seeing you there!</p>`,
  }),
};
