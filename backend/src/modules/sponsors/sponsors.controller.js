const SponsorLead     = require('../../models/SponsorLead');
const AttendeeProfile = require('../../models/AttendeeProfile');
const User            = require('../../models/User');
const EventRegistration = require('../../models/EventRegistration');
const Event           = require('../../models/Event');
const {
  calculateMatchScore,
  getLeadQuality,
  calculateConversionProbability,
  estimateDealValue,
} = require('../../services/aiScoring');

// Helper: format lead for API response
const formatLead = (lead, profile, userEmail) => ({
  id:                   lead._id,
  name:                 `${profile.firstName} ${profile.lastName}`,
  title:                profile.jobTitle  || '',
  company:              profile.company   || '',
  matchScore:           lead.matchScore,
  conversionProbability:lead.conversionProbability,
  email:                userEmail || '',
  phone:                profile.phone || '',
  interests:            lead.interests || [],
  previousEngagement:   lead.previousEngagement,
  estimatedValueMin:    lead.estimatedValueMin,
  estimatedValueMax:    lead.estimatedValueMax,
  leadQuality:          lead.leadQuality,
  status:               lead.status,
  createdAt:            lead.createdAt,
});

// ─── GET /api/v1/sponsors/leads ───────────────────────────────────────────────
exports.getLeads = async (req, res, next) => {
  try {
    const { quality, status, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Sponsors only see their own leads
    const filter = { sponsorId: req.user._id };
    if (quality) filter.leadQuality = quality;
    if (status)  filter.status      = status;

    const total = await SponsorLead.countDocuments(filter);
    const leads = await SponsorLead.find(filter)
      .sort({ matchScore: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Enrich with profile + email
    const attendeeIds = leads.map((l) => l.attendeeId);
    const profiles    = await AttendeeProfile.find({ userId: { $in: attendeeIds } }).lean();
    const users       = await User.find({ _id: { $in: attendeeIds } }).select('email').lean();

    const profileMap = {};
    for (const p of profiles) profileMap[p.userId.toString()] = p;
    const emailMap = {};
    for (const u of users) emailMap[u._id.toString()] = u.email;

    const data = leads.map((l) => {
      const profile = profileMap[l.attendeeId.toString()] || {};
      return formatLead(l, profile, emailMap[l.attendeeId.toString()]);
    });

    res.status(200).json({ success: true, total, page: Number(page), limit: Number(limit), data });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/sponsors/leads/:id ──────────────────────────────────────────
exports.getLead = async (req, res, next) => {
  try {
    const lead = await SponsorLead.findOne({ _id: req.params.id, sponsorId: req.user._id }).lean();
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });

    const profile = await AttendeeProfile.findOne({ userId: lead.attendeeId }).lean() || {};
    const user    = await User.findById(lead.attendeeId).select('email').lean();

    res.status(200).json({ success: true, data: formatLead(lead, profile, user?.email) });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/sponsors/leads/:id/status ─────────────────────────────────
exports.updateLeadStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['new', 'viewed', 'contacted', 'converted', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const lead = await SponsorLead.findOneAndUpdate(
      { _id: req.params.id, sponsorId: req.user._id },
      { status },
      { new: true }
    );
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });

    res.status(200).json({ success: true, data: { id: lead._id, status: lead.status } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/sponsors/metrics ────────────────────────────────────────────
exports.getMetrics = async (req, res, next) => {
  try {
    const leads     = await SponsorLead.find({ sponsorId: req.user._id }).lean();
    const qualified = leads.filter((l) => l.matchScore >= 60).length;
    const converted = leads.filter((l) => l.status === 'converted').length;
    const hot       = leads.filter((l) => l.leadQuality === 'hot').length;
    const convRate  = leads.length ? +((converted / leads.length) * 100).toFixed(1) : 0;
    const avgMatch  = leads.length
      ? leads.reduce((s, l) => s + (l.matchScore || 0), 0) / leads.length
      : 0;
    const expectedROI = +(2.0 + (avgMatch / 100) * 4.0).toFixed(1);

    res.status(200).json({
      success: true,
      data: { qualifiedLeads: qualified, conversionRate: convRate, expectedROI, hotLeadsCount: hot },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/sponsors/conversion-trend ───────────────────────────────────
exports.getConversionTrend = async (req, res, next) => {
  try {
    const data = [
      { week: 'Week 1', traditional: 12, aiPowered: 24 },
      { week: 'Week 2', traditional: 15, aiPowered: 28 },
      { week: 'Week 3', traditional: 14, aiPowered: 31 },
      { week: 'Week 4', traditional: 16, aiPowered: 35 },
    ];
    res.status(200).json({
      success: true,
      data,
      summary: { traditionalAvg: 14.3, aiPoweredAvg: 29.5, improvement: 106 },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/sponsors/lead-quality ───────────────────────────────────────
exports.getLeadQuality = async (req, res, next) => {
  try {
    const leads = await SponsorLead.find({ sponsorId: req.user._id }).lean();
    const hot   = leads.filter((l) => l.leadQuality === 'hot').length;
    const warm  = leads.filter((l) => l.leadQuality === 'warm').length;
    const cold  = leads.filter((l) => l.leadQuality === 'cold').length;

    res.status(200).json({
      success: true,
      data: [
        { category: 'Hot Leads',  count: hot },
        { category: 'Warm Leads', count: warm },
        { category: 'Cold Leads', count: cold },
      ],
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/sponsors/generate-leads ────────────────────────────────────
// Internal: re-compute & upsert leads for this sponsor from all high+moderate attendees
exports.generateLeads = async (req, res, next) => {
  try {
    const event = await Event.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    if (!event) return res.status(404).json({ success: false, message: 'No active event found.' });

    const regs = await EventRegistration.find({
      eventId:         event._id,
      relevanceStatus: { $in: ['high', 'moderate'] },
    }).lean();

    let created = 0;
    for (const reg of regs) {
      const profile = await AttendeeProfile.findOne({ userId: reg.userId }).lean();
      if (!profile) continue;

      const matchScore  = calculateMatchScore(reg, profile, null);
      const quality     = getLeadQuality(matchScore);
      const convProb    = calculateConversionProbability(profile, matchScore);
      const [min, max]  = estimateDealValue(profile);
      const engagement  = reg.relevanceScore >= 80 ? 'High' : reg.relevanceScore >= 60 ? 'Medium' : 'Low';

      await SponsorLead.findOneAndUpdate(
        { sponsorId: req.user._id, attendeeId: reg.userId, eventId: event._id },
        {
          matchScore, leadQuality: quality,
          conversionProbability: convProb,
          estimatedValueMin: min, estimatedValueMax: max,
          previousEngagement: engagement,
          interests: [profile.eventInterest || 'technology'].filter(Boolean),
        },
        { upsert: true, new: true }
      );
      created++;
    }

    res.status(200).json({ success: true, message: `${created} leads generated for this sponsor.` });
  } catch (err) {
    next(err);
  }
};
