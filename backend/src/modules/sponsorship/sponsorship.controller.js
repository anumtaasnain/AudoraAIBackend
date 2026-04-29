const SponsorshipRequest = require('../../models/SponsorshipRequest');
const Event = require('../../models/Event');
const User = require('../../models/User');
const Message = require('../../models/Message');
const emailService = require('../../services/emailService');
const aiEnhancer = require('../../services/aiEnhancer');

// ─── POST /api/v1/sponsorship/request ───────────────────────────────────────
exports.createSponsorshipRequest = async (req, res, next) => {
  try {
    const { sponsorId, eventId, message, tier, amount } = req.body;

    const event = await Event.findOne({ _id: eventId, organizerId: req.user._id });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found or unauthorized.' });

    const sponsor = await User.findOne({ _id: sponsorId, role: 'sponsor' });
    if (!sponsor) return res.status(404).json({ success: false, message: 'Sponsor not found.' });

    const request = await SponsorshipRequest.create({
      organizerId: req.user._id,
      sponsorId,
      eventId,
      message,
      tier,
      amount
    });

    // Send Email to Sponsor
    const template = emailService.templates.sponsorshipPitch(sponsor.email, event.title, req.user.email);
    await emailService.sendEmail(sponsor.email, template.subject, template.text, template.html);

    res.status(201).json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/sponsorship/my-requests ─────────────────────────────────────
exports.getSponsorshipRequests = async (req, res, next) => {
  try {
    let filter = {};
    if (req.user.role === 'organizer') {
      filter.organizerId = req.user._id;
    } else if (req.user.role === 'sponsor') {
      filter.sponsorId = req.user._id;
    }
    // For admin, filter remains empty {} to see all requests

    const requests = await SponsorshipRequest.find(filter)
      .populate('organizerId', 'email')
      .populate('sponsorId', 'email')
      .populate('eventId', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/sponsorship/:id/status ────────────────────────────────────
exports.updateSponsorshipStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const request = await SponsorshipRequest.findOneAndUpdate(
      { _id: req.params.id, sponsorId: req.user._id },
      { status },
      { new: true }
    );

    if (!request) return res.status(404).json({ success: false, message: 'Request not found or unauthorized.' });

    // Send Email to Organizer
    const organizer = await User.findById(request.organizerId);
    const event = await Event.findById(request.eventId);
    const template = emailService.templates.sponsorshipStatus(organizer.email, event.title, status);
    await emailService.sendEmail(organizer.email, template.subject, template.text, template.html);

    res.status(200).json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/sponsorship/:id/messages ───────────────────────────────────
exports.getMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ sponsorshipRequestId: req.params.id })
      .sort({ createdAt: 1 })
      .lean();
    res.status(200).json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/sponsorship/:id/messages ──────────────────────────────────
exports.sendMessage = async (req, res, next) => {
  try {
    const { text } = req.body;
    const message = await Message.create({
      sponsorshipRequestId: req.params.id,
      senderId: req.user._id,
      text,
    });
    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/sponsorship/enhance-pitch ──────────────────────────────────
exports.enhancePitch = async (req, res, next) => {
  try {
    const { pitch, eventId } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const enhanced = await aiEnhancer.enhancePitch(pitch, event);
    res.status(200).json({ success: true, data: enhanced });
  } catch (err) {
    next(err);
  }
};
