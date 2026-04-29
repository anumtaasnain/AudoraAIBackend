const AttendeeProfile = require('../models/AttendeeProfile');
const EventRegistration = require('../models/EventRegistration');
const User = require('../models/User');
const Event = require('../models/Event');
const Industry = require('../models/Industry');
const EventInterest = require('../models/EventInterest');
const AudienceRequest = require('../models/AudienceRequest');

/**
 * Lead Assignment Assistant
 *
 * Matches organizer requests with the most suitable leads from the database
 * using weighted scoring criteria.
 *
 * Scoring weights:
 * - Niche/industry alignment: 35%
 * - Location match: 25%
 * - Budget compatibility: 20%
 * - Availability/responsiveness: 10%
 * - Additional attributes: 10%
 */

// ─── Helper: Check if lead is available ───────────────────────────────────────
const isLeadAvailable = async (userId, excludeEventId = null) => {
  // A lead is available if:
  // 1. They don't have any approved/pending registrations for other events
  // 2. They aren't already allocated in a pending/paid AudienceRequest for another event
  const registrationFilter = {
    userId,
    status: { $in: ['approved', 'pending_organizer', 'pending_admin'] },
  };
  if (excludeEventId) {
    registrationFilter.eventId = { $ne: excludeEventId };
  }

  const existingRegistration = await EventRegistration.findOne(registrationFilter);
  if (existingRegistration) return false;

  const allocationFilter = {
    allocatedLeads: userId,
    status: { $in: ['pending', 'paid_and_fulfilled'] },
  };
  if (excludeEventId) {
    allocationFilter.eventId = { $ne: excludeEventId };
  }

  const existingAllocation = await AudienceRequest.findOne(allocationFilter);
  if (existingAllocation) return false;

  return true;
};

// ─── Helper: Get total prior assignments count ─────────────────────────────────
const getPriorAssignmentsCount = async (userId) => {
  const pastRegistrationsCount = await EventRegistration.countDocuments({
    userId,
    status: { $in: ['approved', 'attended'] },
  });

  const allocationCount = await AudienceRequest.countDocuments({
    allocatedLeads: userId,
    status: 'paid_and_fulfilled',
  });

  return pastRegistrationsCount + allocationCount;
};

// ─── Helper: Get past attendance stats for availability score ─────────────────
const getAttendanceStats = async (userId) => {
  const pastRegistrations = await EventRegistration.find({
    userId,
    status: { $in: ['approved', 'attended'] },
  });

  const noShowCount = await EventRegistration.countDocuments({
    userId,
    attendanceStatus: 'no_show',
  });

  const attendedCount = pastRegistrations.length;

  return { attendedCount, noShowCount };
};

// ─── Helper: Calculate industry/niche alignment score (0-100) ──────────────────
const calculateNicheScore = (organizerProfile, leadProfile) => {
  let score = 0;

  // Industry match (max 25 points out of 35 weight)
  if (organizerProfile.industryId && leadProfile.industryIds && leadProfile.industryIds.length > 0) {
    const organizerIndustrySlug = organizerProfile.industryId?.slug || '';
    const leadIndustrySlug = leadProfile.industryIds[0]?.slug || '';

    if (organizerIndustrySlug && leadIndustrySlug) {
      if (organizerIndustrySlug === leadIndustrySlug) {
        score += 25;
      } else {
        // Affinity map
        const affinityMap = {
          technology: ['software', 'cloud', 'analytics', 'security', 'devops', 'ai-ml'],
          software:   ['technology', 'cloud', 'devops', 'data'],
          cloud:      ['technology', 'software', 'devops', 'data'],
          analytics:  ['technology', 'data', 'software', 'ai-ml'],
          data:       ['technology', 'analytics', 'cloud', 'ai-ml'],
          security:   ['technology', 'cloud', 'devops'],
          devops:     ['software', 'cloud', 'technology'],
          'ai-ml':    ['technology', 'data', 'analytics'],
          marketing:  ['sales', 'product'],
          sales:      ['marketing', 'product'],
          finance:    ['technology', 'data'],
          healthcare: ['technology', 'data'],
          product:    ['marketing', 'sales', 'startup'],
          startup:    ['product', 'leadership'],
          leadership: ['startup', 'product'],
        };
        const organizerKey = Object.keys(affinityMap).find(k => affinityMap[k].includes(organizerIndustrySlug));
        if (organizerKey && affinityMap[organizerKey]?.includes(leadIndustrySlug)) {
          score += 15;
        }
      }
    }
  }

  // Interest/category match (max 10 points)
  if (organizerProfile.interestId && leadProfile.interestIds && leadProfile.interestIds.length > 0) {
    const organizerInterestSlug = organizerProfile.interestId?.slug || '';
    const leadInterestSlug = leadProfile.interestIds[0]?.slug || '';

    if (organizerInterestSlug && leadInterestSlug) {
      if (organizerInterestSlug === leadInterestSlug) {
        score += 10;
      } else {
        // Related interests partial credit
        const relatedInterests = {
          'ai-ml':    ['data', 'cloud', 'analytics'],
          'cloud':    ['devops', 'security', 'ai-ml'],
          'devops':   ['cloud', 'security'],
          'data':     ['ai-ml', 'analytics', 'cloud'],
          'security': ['cloud', 'devops'],
          'product':  ['leadership', 'startup'],
          'startup':  ['product', 'leadership'],
          'leadership': ['startup', 'product'],
        };
        if (relatedInterests[organizerInterestSlug] && relatedInterests[organizerInterestSlug].includes(leadInterestSlug)) {
          score += 5;
        }
      }
    }
  }

  // Scale max 35 points to 0-100
  return Math.min(100, Math.round(score * (100 / 35)));
};

// ─── Helper: Calculate location match score (0-100) ───────────────────────────
const calculateLocationScore = (organizerProfile, leadProfile) => {
  // Note: Current AttendeeProfile model does NOT have a location field.
  // This is a placeholder that returns a neutral score.
  // In production, add location field to AttendeeProfile and implement fuzzy matching.

  const organizerLocation = (organizerProfile.location || '').toLowerCase().trim();
  if (!organizerLocation) {
    return 50; // No organizer location specified → neutral
  }

  // Since attendee location isn't available, return neutral score
  return 50;
};

// ─── Helper: Calculate budget compatibility score (0-100) ──────────────────────
const calculateBudgetScore = (organizerProfile, leadProfile) => {
  // Note: No explicit budget field in current models.
  // Using companySize as proxy for budget capacity.

  const organizerBudget = organizerProfile.organizerBudget;

  // Map company size to a numeric tier (1=smallest, 6=largest)
  const sizeScores = {
    '1-10':     1,
    '11-50':    2,
    '51-200':   3,
    '201-500':  4,
    '501-1000': 5,
    '1000+':    6,
    Small:      2,
    Medium:     4,
    Large:      6,
  };

  // Derive organizer size tier from budget or explicit companySize
  let organizerSizeScore = 3; // default medium
  if (organizerProfile.organizerCompanySize) {
    organizerSizeScore = sizeScores[organizerProfile.organizerCompanySize] || 3;
  } else if (organizerBudget) {
    // Approximate from budget: $5 per lead base → determine scale
    if (organizerBudget >= 25000) organizerSizeScore = 6;
    else if (organizerBudget >= 10000) organizerSizeScore = 5;
    else if (organizerBudget >= 5000) organizerSizeScore = 4;
    else if (organizerBudget >= 2500) organizerSizeScore = 3;
    else organizerSizeScore = 2;
  }

  const leadSizeScore = sizeScores[leadProfile.companySize] || 3;

  // Closer size tiers = better compatibility
  const diff = Math.abs(organizerSizeScore - leadSizeScore);

  let score = 100 - (diff * 20);
  score = Math.max(30, Math.min(100, score));

  return Math.round(score);
};

// ─── Helper: Calculate availability/responsiveness score (0-100) ───────────────
const calculateAvailabilityScore = async (userId) => {
  const { attendedCount, noShowCount } = await getAttendanceStats(userId);
  const total = attendedCount + noShowCount;

  if (total === 0) return 70; // New lead, neutral to positive

  const attendanceRate = attendedCount / total;
  let score = Math.round(attendanceRate * 100);

  // No-show penalty: -5 per no-show
  score = Math.max(30, score - noShowCount * 5);

  // Bonus for experienced attendees
  if (attendedCount >= 5) score += 10;
  else if (attendedCount >= 3) score += 5;

  return Math.min(100, score);
};

// ─── Helper: Calculate additional attributes score (0-100) ─────────────────────
const calculateExtraScore = (leadProfile) => {
  let score = 50; // baseline

  // Seniority level (job title)
  const seniorityKeywords = {
    ceo: 100, cto: 100, cfo: 100, coo: 100, ciso: 100, cpo: 100,
    'chief technology officer': 100,
    'chief executive officer':  100,
    'chief financial officer':  100,
    'chief operating officer':  100,
    president: 95,
    'vice president': 90, 'vp of': 90, 'vp,': 90,
    director: 80,
    'head of': 75,
    'product manager': 65,
    manager: 65,
    lead: 60,
    senior: 55,
    'business analyst': 50,
    analyst: 45,
    engineer: 40,
    developer: 40,
    consultant: 40,
    specialist: 35,
    coordinator: 30,
    assistant: 20,
    support: 20,
  };

  if (leadProfile.jobTitle) {
    const title = leadProfile.jobTitle.toLowerCase();
    for (const [keyword, pts] of Object.entries(seniorityKeywords)) {
      if (title.includes(keyword)) {
        score = Math.max(score, pts);
        break;
      }
    }
  }

  // Profile completeness bonus
  const completeness = getProfileCompleteness(leadProfile);
  score = Math.round(score * 0.7 + completeness * 0.3);

  return Math.min(100, score);
};

const getProfileCompleteness = (profile) => {
  const fields = [
    profile.firstName, profile.lastName, profile.phone,
    profile.company, profile.jobTitle, profile.industryIds,
    profile.companySize, profile.interestIds,
  ];
  const filled = fields.filter(f => Array.isArray(f) ? f.length > 0 : !!f).length;
  return Math.round((filled / fields.length) * 100);
};

// ─── Main scoring function ────────────────────────────────────────────────────
const scoreLead = async (organizerProfile, requiredLeadsCount, lead, allLeads, excludeEventId = null) => {
  const userId = lead.userId;

  // Fetch extended data in parallel
  const [isAvailable, availabilityScore, extraScore, priorAssignmentsCount] = await Promise.all([
    isLeadAvailable(userId, excludeEventId),
    calculateAvailabilityScore(userId),
    calculateExtraScore(lead),
    getPriorAssignmentsCount(userId),
  ]);

  if (!isAvailable) {
    return null; // Skip unavailable leads
  }

  const nicheScore = calculateNicheScore(organizerProfile, lead);
  const locationScore = calculateLocationScore(organizerProfile, lead);
  const budgetScore = calculateBudgetScore(organizerProfile, lead);

  // Weighted combination (total = 100%)
  const matchScore = Math.round(
    nicheScore          * 0.35 +
    locationScore       * 0.25 +
    budgetScore         * 0.20 +
    availabilityScore   * 0.10 +
    extraScore          * 0.10
  );

  // Generate match reasons
  const matchReasons = [];

  if (nicheScore >= 70) {
    matchReasons.push('Strong industry/niche alignment');
  } else if (nicheScore >= 40) {
    matchReasons.push('Moderate industry fit');
  } else {
    matchReasons.push('Low industry relevance');
  }

  if (locationScore >= 70) {
    matchReasons.push('Geographic match');
  }

  if (budgetScore >= 70) {
    matchReasons.push('Budget compatible');
  }

  if (availabilityScore >= 80) {
    matchReasons.push('High availability & responsiveness');
  } else if (availabilityScore < 50) {
    matchReasons.push('Low availability signal');
  }

  // Attribute-based reasons
  if (lead.companySize === '1000+' || lead.companySize === 'Large') {
    matchReasons.push('Enterprise lead (high potential value)');
  }

  if (lead.jobTitle && (lead.jobTitle.toLowerCase().includes('director') || lead.jobTitle.toLowerCase().includes('manager'))) {
    matchReasons.push('Decision-maker or influencer');
  }

  return {
    lead_id: userId,
    name: `${lead.firstName} ${lead.lastName}`,
    match_score: matchScore,
    match_reasons: matchReasons,
    raw_lead: lead,
    prior_assignments_count: priorAssignmentsCount,
  };
};

// ─── Main assignment function ─────────────────────────────────────────────────
/**
 * Assign leads to an organizer based on their profile and requirements.
 *
 * @param {Object} organizer_profile - Organizer/event profile with criteria
 * @param {number} required_leads_count - Number of leads to assign
 * @param {Array} leads_database - Array of available lead profiles (AttendeeProfile)
 * @returns {Object} Assignment package
 */
const assignLeads = async (organizer_profile, required_leads_count, leads_database) => {
  // Input validation
  if (!required_leads_count || required_leads_count <= 0) {
    return {
      assignment_status: 'error',
      notes: 'Invalid lead count.',
    };
  }

  if (!leads_database || leads_database.length === 0) {
    return {
      assignment_status: 'error',
      notes: 'No leads available in database.',
    };
  }

  // Score all leads (filter unavailable ones in the scoring step)
  const scoredResults = await Promise.all(
    leads_database.map(lead => scoreLead(organizer_profile, required_leads_count, lead, leads_database))
  );

  // Filter out null results (unavailable leads)
  const validScoredLeads = scoredResults.filter(r => r !== null);

  if (validScoredLeads.length === 0) {
    return {
      assignment_status: 'error',
      notes: 'No available leads found (all already assigned or ineligible).',
    };
  }

  // Sort by score descending, then by prior_assignments_count ascending (fresher first)
  validScoredLeads.sort((a, b) => {
    if (b.match_score !== a.match_score) {
      return b.match_score - a.match_score;
    }
    // Tie-breaker: fewer prior assignments first
    return a.prior_assignments_count - b.prior_assignments_count;
  });

  // Check if we have enough leads
  if (validScoredLeads.length < required_leads_count) {
    // Partial fulfillment
    const selected = validScoredLeads.slice(0, validScoredLeads.length);
    return {
      organizer_id: organizer_profile._id || organizer_profile.organizerId,
      organizer_name: organizer_profile.title || 'Event Organizer',
      required_leads: required_leads_count,
      assigned_leads: selected.map(s => ({
        lead_id: s.lead_id,
        name: s.name,
        match_score: s.match_score,
        match_reasons: s.match_reasons,
      })),
      assignment_status: 'partial',
      notes: `Only ${validScoredLeads.length} leads available. Admin action required to source more leads.`,
    };
  }

  // Check for low-confidence matches (average score < 30)
  const topSelection = validScoredLeads.slice(0, required_leads_count);
  const avgScore = topSelection.reduce((sum, s) => sum + s.match_score, 0) / required_leads_count;

  let assignmentStatus = 'success';
  let notes = '';

  if (avgScore < 30) {
    // Still success because we fulfilled the count, but with low-confidence warning
    notes = 'Low-confidence matches (average score below 30). Consider reviewing criteria or expanding lead pool.';
  }

  // Return exactly required_leads_count entries
  return {
    organizer_id: organizer_profile._id || organizer_profile.organizerId,
    organizer_name: organizer_profile.title || 'Event Organizer',
    required_leads: required_leads_count,
    assigned_leads: topSelection.map(s => ({
      lead_id: s.lead_id,
      name: s.name,
      match_score: s.match_score,
      match_reasons: s.match_reasons,
    })),
    assignment_status: assignmentStatus,
    notes: notes,
  };
};

module.exports = {
  assignLeads,
  scoreLead,
};
