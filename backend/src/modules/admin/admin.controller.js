const { assignLeads } = require('../../services/leadAssignment');
const AudienceRequest = require('../../models/AudienceRequest');
const AttendeeProfile = require('../../models/AttendeeProfile');
const EventRegistration = require('../../models/EventRegistration');
const { protect } = require('../../middleware/auth');
const { authorize } = require('../../middleware/roles');

// ─── POST /api/v1/admin/assign-leads ──────────────────────────────────────────
// Admin endpoint to manually assign leads to an organizer's payment-verified request
exports.assignLeadsHandler = async (req, res, next) => {
  try {
    const { audienceRequestId } = req.body;

    if (!audienceRequestId) {
      return res.status(400).json({
        success: false,
        message: 'audienceRequestId is required',
      });
    }

    // Fetch the audience request (payment-verified only)
    const audienceRequest = await AudienceRequest.findOne({
      _id: audienceRequestId,
      status: 'paid_and_fulfilled',
    }).populate({
      path: 'eventId',
      populate: { path: 'industryId interestId' }
    }).populate('organizerId');

    if (!audienceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Audience request not found or not payment-verified.',
      });
    }

    const { eventId, organizerId, requestedParticipants } = audienceRequest;

    // Build organizer profile from event + organizer user
    const organizerProfile = {
      _id: organizerId._id,
      organizerId: organizerId._id,
      title: eventId.title,
      description: eventId.description,
      location: eventId.location || '',
      interestId: eventId.interestId,
      industryId: eventId.industryId,
      organizerCompanySize: organizerId.profile?.companySize || organizerId.companySize,
      organizerBudget: requestedParticipants * 5,
    };

    // Fetch all attendee profiles
    const allProfiles = await AttendeeProfile.find()
      .populate('industryIds interestIds')
      .lean();

    // Call assignment service
    const result = await assignLeads(organizerProfile, requestedParticipants, allProfiles);

    // If assignment was successful, update the AudienceRequest with allocated leads
    if (result.assignment_status === 'success' || result.assignment_status === 'partial') {
      const allocatedUserIds = result.assigned_leads.map(l => l.lead_id);
      audienceRequest.allocatedLeads = allocatedUserIds;
      audienceRequest.status = 'paid_and_fulfilled';
      await audienceRequest.save();

      // Create/update EventRegistration entries with 'approved' status
      const registrationsToCreate = result.assigned_leads.map(lead => ({
        eventId: eventId._id,
        userId: lead.lead_id,
        relevanceScore: lead.match_score,
        relevanceStatus: lead.match_score >= 80 ? 'high' : lead.match_score >= 60 ? 'moderate' : 'low',
        aiAnalysis: `Lead assigned by admin. Reasons: ${lead.match_reasons.join('; ')}`,
        isQualifiedLead: lead.match_score >= 60,
        status: 'approved',
      }));

      if (registrationsToCreate.length > 0) {
        for (const reg of registrationsToCreate) {
          await EventRegistration.findOneAndUpdate(
            { eventId: reg.eventId, userId: reg.userId },
            reg,
            { upsert: true, new: true }
          );
        }
      }
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/admin/assign-leads/preview ───────────────────────────────────
// Preview lead assignments without actually assigning them
exports.previewAssignments = async (req, res, next) => {
  try {
    const { audienceRequestId } = req.query;

    if (!audienceRequestId) {
      return res.status(400).json({
        success: false,
        message: 'audienceRequestId is required',
      });
    }

    const audienceRequest = await AudienceRequest.findOne({
      _id: audienceRequestId,
      status: 'paid_and_fulfilled',
    }).populate({
      path: 'eventId',
      populate: { path: 'industryId interestId' }
    }).populate('organizerId');

    if (!audienceRequest) {
      return res.status(404).json({
        success: false,
        message: 'Audience request not found or not payment-verified.',
      });
    }

    const { eventId, organizerId, requestedParticipants } = audienceRequest;

    const organizerProfile = {
      _id: organizerId._id,
      organizerId: organizerId._id,
      title: eventId.title,
      description: eventId.description,
      location: eventId.location || '',
      interestId: eventId.interestId,
      industryId: eventId.industryId,
      organizerCompanySize: organizerId.profile?.companySize || organizerId.companySize,
      organizerBudget: requestedParticipants * 5,
    };

    const allProfiles = await AttendeeProfile.find()
      .populate('industryIds interestIds')
      .lean();

    const result = await assignLeads(organizerProfile, requestedParticipants, allProfiles);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
