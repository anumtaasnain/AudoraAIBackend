const LeadRequest = require('../../models/LeadRequest');
const Event = require('../../models/Event');
const AttendeeProfile = require('../../models/AttendeeProfile');
const User = require('../../models/User');
const EventRegistration = require('../../models/EventRegistration');
const { assignLeads } = require('../../services/leadAssignment');
const { protect, authorize } = require('../../middleware/auth');
const { calculateAIRelevanceScore } = require('../../services/aiScoring');
const emailService = require('../../services/emailService');

// ─── POST /api/v1/lead-requests ────────────────────────────────────────────────
// Create a new lead request (organizer only) and create Stripe Checkout session
exports.createLeadRequest = async (req, res, next) => {
  try {
    const { eventId, requestedLeadCount } = req.body;
    const organizerId = req.user._id;

    // Validate event exists and organizer owns it
    const event = await Event.findOne({ _id: eventId, organizerId });
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found or unauthorized.' });
    }

    const leadCount = parseInt(requestedLeadCount);
    if (!leadCount || leadCount < 1) {
      return res.status(400).json({ success: false, message: 'Invalid lead count.' });
    }

    const PRICE_PER_LEAD = 5.00;
    const totalAmount = leadCount * PRICE_PER_LEAD;

    // In demo mode, skip Stripe
    const isDemoMode = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_dummy';

    let stripeSessionId, clientSecret, paymentIntentId;

    if (isDemoMode) {
      paymentIntentId = `pi_demo_${Date.now()}`;
      clientSecret = `${paymentIntentId}_secret_demo`;
      stripeSessionId = `cs_demo_${Date.now()}`;
      // Mock checkout URL for demo that immediately redirects back with session_id
      const checkoutUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/events/${eventId}/report?session_id=${stripeSessionId}&demo=true`;
      const leadRequest = await LeadRequest.create({
        organizerId,
        eventId,
        requestedLeadCount: leadCount,
        amountPaid: totalAmount,
        stripeSessionId,
        status: 'pending',
      });
      return res.status(201).json({
        success: true,
        isDemoMode: true,
        stripeSessionId,
        checkoutUrl,
        data: leadRequest,
      });
    } else {
      // Real Stripe Checkout Session
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `High-Profile Leads for ${event.title}`,
              description: `${leadCount} premium attendee leads`,
            },
            unit_amount: Math.round(totalAmount * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/events/${eventId}/report?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/events/${eventId}`,
        metadata: {
          eventId,
          organizerId: organizerId.toString(),
          requestedLeadCount: leadCount.toString(),
        },
      });
      stripeSessionId = session.id;
      const leadRequest = await LeadRequest.create({
        organizerId,
        eventId,
        requestedLeadCount: leadCount,
        amountPaid: totalAmount,
        stripeSessionId,
        status: 'pending',
      });
      return res.status(201).json({
        success: true,
        isDemoMode: false,
        checkoutUrl: session.url,
        data: leadRequest,
      });
    }
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/lead-requests/my ─────────────────────────────────────────────
// Organizer: get their own lead requests
exports.getMyLeadRequests = async (req, res, next) => {
  try {
    const myLeadRequests = await LeadRequest.find({ organizerId: req.user._id })
      .populate('eventId', 'title description')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, data: myLeadRequests });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/lead-requests/all ────────────────────────────────────────────
// Admin: get all lead requests
exports.getAllLeadRequests = async (req, res, next) => {
  try {
    const all = await LeadRequest.find()
      .populate('organizerId', 'email')
      .populate('eventId', 'title')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, data: all });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/lead-requests/:id/confirm ───────────────────────────────────
// Confirmation endpoint called after Stripe Checkout success (server-side verify or just record)
exports.confirmLeadRequest = async (req, res, next) => {
  try {
    const { stripeSessionId } = req.body;
    const leadRequest = await LeadRequest.findOne({ stripeSessionId });

    if (!leadRequest) {
      return res.status(404).json({ success: false, message: 'Lead request not found.' });
    }

    if (leadRequest.status === 'assigned') {
      return res.status(400).json({ success: false, message: 'Lead request already fulfilled.' });
    }

    // In a real implementation, verify Stripe PaymentIntent status here
    // For demo, we just mark as payment received (still pending admin assignment)
    // Status remains 'pending'

    // Send confirmation email to organizer
    const organizer = await User.findById(leadRequest.organizerId);
    const event = await Event.findById(leadRequest.eventId);
    const emailTemplate = emailService.templates.leadRequestReceived(
      organizer.email,
      event.title,
      leadRequest.requestedLeadCount,
      leadRequest.amountPaid
    );
    await emailService.sendEmail(organizer.email, emailTemplate.subject, emailTemplate.text, emailTemplate.html);

    res.status(200).json({
      success: true,
      message: 'Payment confirmed. Lead request is pending admin assignment.',
      data: leadRequest,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/lead-requests/:id/assign ────────────────────────────────────
// Admin: assign leads to a lead request
exports.assignLeadsToRequest = async (req, res, next) => {
  try {
    const leadRequest = await LeadRequest.findById(req.params.id)
      .populate({
        path: 'eventId',
        populate: { path: 'industryId interestId' }
      })
      .populate('organizerId');

    if (!leadRequest) {
      return res.status(404).json({ success: false, message: 'Lead request not found.' });
    }

    if (leadRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Lead request is not in pending state.' });
    }

    // Fetch all profiles
    const allProfiles = await AttendeeProfile.find()
      .populate('industryIds interestIds')
      .lean();

    // Build organizer profile from event
    const organizerProfile = {
      _id: leadRequest.organizerId._id,
      organizerId: leadRequest.organizerId._id,
      title: leadRequest.eventId.title,
      description: leadRequest.eventId.description,
      location: leadRequest.eventId.location || '',
      interestId: leadRequest.eventId.interestId,
      industryId: leadRequest.eventId.industryId,
      organizerCompanySize: leadRequest.organizerId.profile?.companySize,
      organizerBudget: leadRequest.requestedLeadCount * 5,
    };

    // Run assignment
    const result = await assignLeads(organizerProfile, leadRequest.requestedLeadCount, allProfiles);

    if (result.assignment_status === 'error') {
      return res.status(400).json({ success: false, message: result.notes });
    }

    // Note: result.assigned_leads may be fewer than requested if insufficient pool. That's allowed (partial assignment).

    // Save assigned leads
    const assignedUserIds = result.assigned_leads.map(l => l.lead_id);
    leadRequest.assignedLeads = assignedUserIds;
    leadRequest.status = 'assigned';
    await leadRequest.save();

    // Create EventRegistration entries
    const EventRegistration = require('../../models/EventRegistration');
    for (const lead of result.assigned_leads) {
      await EventRegistration.findOneAndUpdate(
        { eventId: leadRequest.eventId._id, userId: lead.lead_id },
        {
          eventId: leadRequest.eventId._id,
          userId: lead.lead_id,
          relevanceScore: lead.match_score,
          relevanceStatus: lead.match_score >= 80 ? 'high' : lead.match_score >= 60 ? 'moderate' : 'low',
          aiAnalysis: `Lead assigned via bulk request. Reasons: ${lead.match_reasons.join('; ')}`,
          isQualifiedLead: lead.match_score >= 60,
          status: 'approved',
        },
        { upsert: true, new: true }
      );
    }

    // Send assigned email to organizer
    const emailTemplate = emailService.templates.leadRequestAssigned(
      leadRequest.organizerId.email,
      leadRequest.eventId.title,
      leadRequest.requestedLeadCount,
      leadRequest.amountPaid
    );
    await emailService.sendEmail(leadRequest.organizerId.email, emailTemplate.subject, emailTemplate.text, emailTemplate.html);

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${result.assigned_leads.length} of ${leadRequest.requestedLeadCount} requested leads.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/lead-requests/:id/assigned-leads ─────────────────────────────
// Organizer: view full details of assigned leads for a request
exports.getAssignedLeads = async (req, res, next) => {
  try {
    const leadRequest = await LeadRequest.findOne({
      _id: req.params.id,
      organizerId: req.user._id,
      status: 'assigned',
    }).populate('assignedLeads');

    if (!leadRequest) {
      return res.status(404).json({ success: false, message: 'Assigned leads not found.' });
    }

    // Enrich with profile data
    const profiles = await AttendeeProfile.find({ userId: { $in: leadRequest.assignedLeads } })
      .populate('industryIds interestIds')
      .lean();

    const userIds = profiles.map(p => p.userId);
    const users = await User.find({ _id: { $in: userIds } }).select('email').lean();
    const emailMap = {};
    for (const u of users) emailMap[u._id.toString()] = u.email;

    const enrichedLeads = profiles.map(p => ({
      id: p.userId,
      name: `${p.firstName} ${p.lastName}`,
      email: emailMap[p.userId.toString()] || '',
      phone: p.phone || '',
      jobTitle: p.jobTitle || '',
      company: p.company || '',
      industry: p.industryIds?.[0]?.name || '',
      companySize: p.companySize || '',
    }));

    res.status(200).json({ success: true, data: enrichedLeads });
  } catch (err) {
    next(err);
  }
};
