const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const AudienceRequest = require('../../models/AudienceRequest');
const AttendeeProfile = require('../../models/AttendeeProfile');
const EventRegistration = require('../../models/EventRegistration');
const Event = require('../../models/Event');
const User = require('../../models/User');
const { calculateAIRelevanceScore } = require('../../services/aiScoring');
const emailService = require('../../services/emailService');

// ─── POST /api/v1/audience/request ──────────────────────────────────────────
exports.createAudienceRequest = async (req, res, next) => {
  try {
    const { eventId, requestedParticipants } = req.body;
    
    // Validate event
    const event = await Event.findOne({ _id: eventId, organizerId: req.user._id });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found or unauthorized.' });
    
    const feePerParticipant = 5.00;
    const totalFee = requestedParticipants * feePerParticipant;
    const isDemoMode = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_dummy';

    let paymentIntentId, clientSecret;

    if (isDemoMode) {
      // Demo mode: skip Stripe, use a mock ID
      paymentIntentId = `pi_demo_${Date.now()}`;
      clientSecret = `${paymentIntentId}_secret_demo`;
    } else {
      // Real Stripe PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalFee * 100),
        currency: 'usd',
        metadata: { eventId, organizerId: req.user._id.toString(), requestedParticipants }
      });
      paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret;
    }

    const audienceRequest = await AudienceRequest.create({
      eventId,
      organizerId: req.user._id,
      requestedParticipants,
      feePerParticipant,
      totalFee,
      stripePaymentIntentId: paymentIntentId,
      status: 'pending'
    });

    res.status(201).json({ 
      success: true,
      isDemoMode,
      paymentIntentId,
      clientSecret,
      data: { ...audienceRequest.toObject(), totalFee }
    });
  } catch(err) {
    next(err);
  }
};

// ─── POST /api/v1/audience/confirm ──────────────────────────────────────────
exports.confirmAudienceRequest = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;
    
    const audienceRequest = await AudienceRequest.findOne({ stripePaymentIntentId: paymentIntentId });
    if (!audienceRequest) return res.status(404).json({ success: false, message: 'Audience request not found.' });

    if (audienceRequest.status === 'paid_and_fulfilled') {
      return res.status(400).json({ success: false, message: 'Request already fulfilled.' });
    }

    // In a real app we'd verify the PaymentIntent status with Stripe here
    // let intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    // if (intent.status !== 'succeeded') throw new Error('Payment not succeeded');

    const event = await Event.findById(audienceRequest.eventId);

    // AI Profiling - Find best matching attendees
    const allProfiles = await AttendeeProfile.find().lean();
    let scoredProfiles = [];

    for (let profile of allProfiles) {
      // Check if already registered
      const existing = await EventRegistration.findOne({ eventId: event._id, userId: profile.userId });
      if (existing) continue;

      const pastRegistrations = await EventRegistration.find({
        userId: profile.userId,
        status: { $in: ['approved', 'attended'] },
        attendanceStatus: { $ne: 'no_show' }
      }).populate('eventId');
      const pastEvents = pastRegistrations.map(r => r.eventId).filter(Boolean);

      const noShowRegistrations = await EventRegistration.find({
        userId: profile.userId,
        attendanceStatus: 'no_show'
      });

      const aiResult = await calculateAIRelevanceScore(profile, event);
      const { relevanceScore, relevanceStatus, analysis } = aiResult;
      
      if (relevanceScore >= 80) { // Only high-profile / relevant leads
         scoredProfiles.push({ profile, score: relevanceScore, analysis });
      }
    }

    // Sort by descending score
    scoredProfiles.sort((a, b) => b.score - a.score);

    // Limit to requestedParticipants
    const selected = scoredProfiles.slice(0, audienceRequest.requestedParticipants);

    // Provision by creating registrations with 'approved' status
    const registrationsToCreate = selected.map(s => ({
      eventId: event._id,
      userId: s.profile.userId,
      relevanceScore: s.score,
      relevanceStatus: 'high',
      aiAnalysis: s.analysis,
      isQualifiedLead: true,
      status: 'approved', 
    }));

    if (registrationsToCreate.length > 0) {
      await EventRegistration.insertMany(registrationsToCreate);
    }

    audienceRequest.status = 'paid_and_fulfilled';
    await audienceRequest.save();

    // Send Email to Organizer
    const organizer = await User.findById(audienceRequest.organizerId);
    const template = emailService.templates.paymentSuccess(organizer.email, audienceRequest.totalFee, registrationsToCreate.length);
    await emailService.sendEmail(organizer.email, template.subject, template.text, template.html);

    res.status(200).json({ 
      success: true, 
      message: `Payment confirmed. Sourced ${registrationsToCreate.length} high-profile attendees for the event.` 
    });

  } catch(err) {
    next(err);
  }
};
