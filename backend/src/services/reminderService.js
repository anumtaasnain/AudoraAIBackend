const cron = require('node-cron');
const Event = require('../models/Event');
const EventRegistration = require('../models/EventRegistration');
const User = require('../models/User');
const emailService = require('./emailService');

// Run every day at 09:00 AM
cron.schedule('0 9 * * *', async () => {
  console.log('⏰ Running daily event reminders...');
  await sendReminders();
});

async function sendReminders() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextDay = new Date(tomorrow);
    nextDay.setDate(nextDay.getDate() + 1);

    // 1. Events starting today
    const todayEvents = await Event.find({
      startsAt: { $gte: today, $lt: tomorrow },
      status: 'approved'
    });

    // 2. Events starting tomorrow
    const tomorrowEvents = await Event.find({
      startsAt: { $gte: tomorrow, $lt: nextDay },
      status: 'approved'
    });

    // Helper to send to attendees
    const notifyAttendees = async (events, daysLeft) => {
      for (const event of events) {
        const registrations = await EventRegistration.find({ 
          eventId: event._id, 
          status: 'approved' 
        }).populate('userId');

        for (const reg of registrations) {
          if (reg.userId && reg.userId.email) {
            const template = emailService.templates.reminder(reg.userId.email, event.title, daysLeft);
            await emailService.sendEmail(reg.userId.email, template.subject, template.text, template.html);
          }
        }
      }
    };

    await notifyAttendees(todayEvents, 0);
    await notifyAttendees(tomorrowEvents, 1);

  } catch (err) {
    console.error('❌ Reminder Job Failed:', err);
  }
}

module.exports = { sendReminders };
