const { analyzeAttendeeRelevance } = require('./geminiService');

/**
 * AI Scoring Service
 * Computes relevance scores entirely within the backend
 * based on the rules defined in BACKEND_README.md.
 */

// ─── Seniority scoring ────────────────────────────────────────────────────────
const SENIORITY_SCORES = {
  ceo: 100, cto: 100, cfo: 100, coo: 100, ciso: 100, cpo: 100,
  'chief technology officer': 100,
  'chief executive officer':  100,
  'chief financial officer':  100,
  'chief operating officer':  100,
  president: 95,
  'vice president': 90, 'vp of': 90, 'vp,': 90,
  director: 80,
  'head of': 75,
  manager: 65,
  lead: 60,
  senior: 55,
  'product manager': 65,
  'business analyst': 50,
  analyst: 45,
  engineer: 40,
  developer: 40,
  specialist: 35,
  consultant: 40,
  coordinator: 30,
  assistant: 20,
  support: 20,
};

const getSeniorityScore = (jobTitle = '') => {
  const title = jobTitle.toLowerCase();
  for (const [keyword, score] of Object.entries(SENIORITY_SCORES)) {
    if (title.includes(keyword)) return score;
  }
  return 35; // default
};

// ─── Company size scoring ─────────────────────────────────────────────────────
const COMPANY_SIZE_SCORES = {
  '1-10':     40,
  '11-50':    55,
  '51-200':   70,
  '201-500':  80,
  '501-1000': 90,
  '1000+':    100,
};

// ─── Industry to event type match ─────────────────────────────────────────────
// (industry from registration) -> score for each eventType
const INDUSTRY_EVENT_MATCH = {
  technology: { 'ai-ml': 100, cloud: 90, devops: 85, data: 80, security: 75, product: 70, leadership: 65, startup: 60 },
  software:   { 'ai-ml': 90, cloud: 85, devops: 95, data: 75, security: 80, product: 80, leadership: 60, startup: 70 },
  cloud:      { 'ai-ml': 75, cloud: 100, devops: 90, data: 70, security: 65, product: 65, leadership: 55, startup: 55 },
  analytics:  { 'ai-ml': 90, cloud: 65, devops: 60, data: 100, security: 55, product: 70, leadership: 55, startup: 60 },
  marketing:  { 'ai-ml': 55, cloud: 45, devops: 35, data: 65, security: 40, product: 75, leadership: 70, startup: 70 },
  sales:      { 'ai-ml': 45, cloud: 40, devops: 30, data: 55, security: 35, product: 65, leadership: 75, startup: 65 },
  finance:    { 'ai-ml': 60, cloud: 50, devops: 40, data: 70, security: 65, product: 55, leadership: 70, startup: 50 },
  healthcare: { 'ai-ml': 55, cloud: 50, devops: 40, data: 65, security: 70, product: 60, leadership: 60, startup: 50 },
  other:      { 'ai-ml': 40, cloud: 40, devops: 40, data: 40, security: 40, product: 40, leadership: 40, startup: 40 },
};

// Event interest alignment (profile's interest vs event type)
const INTEREST_EVENT_MATCH = {
  'ai-ml':      { 'ai-ml': 100, cloud: 70, devops: 60, data: 85, security: 50, product: 60, leadership: 45, startup: 65 },
  cloud:        { 'ai-ml': 60, cloud: 100, devops: 85, data: 60, security: 55, product: 55, leadership: 45, startup: 50 },
  devops:       { 'ai-ml': 50, cloud: 80, devops: 100, data: 55, security: 70, product: 55, leadership: 40, startup: 50 },
  data:         { 'ai-ml': 85, cloud: 60, devops: 55, data: 100, security: 50, product: 65, leadership: 45, startup: 55 },
  security:     { 'ai-ml': 55, cloud: 60, devops: 70, data: 55, security: 100, product: 50, leadership: 50, startup: 45 },
  product:      { 'ai-ml': 60, cloud: 55, devops: 50, data: 65, security: 45, product: 100, leadership: 75, startup: 80 },
  leadership:   { 'ai-ml': 50, cloud: 45, devops: 40, data: 50, security: 45, product: 70, leadership: 100, startup: 80 },
  startup:      { 'ai-ml': 65, cloud: 55, devops: 55, data: 55, security: 45, product: 80, leadership: 80, startup: 100 },
};

// ─── Profile completeness ─────────────────────────────────────────────────────
const getCompletenessScore = (profile) => {
  const fields = [
    profile.firstName, profile.lastName, profile.phone,
    profile.company, profile.jobTitle, profile.industryIds,
    profile.companySize, profile.interestIds, profile.hearAboutUs,
  ];
  const filled = fields.filter(f => Array.isArray(f) ? f.length > 0 : !!f).length;
  return Math.round((filled / fields.length) * 100);
};

// ─── Main scoring function ────────────────────────────────────────────────────
/**
 * Calculate attendee relevance score for a given event.
 * @param {Object} profile    - AttendeeProfile document
 * @param {Object} event      - Event document
 * @param {Array} pastEvents  - Array of past Event documents attended
 * @param {Array} noShowEvents - Array of past EventRegistration documents where attendanceStatus = no_show
 * @returns {number}          - score 0–100
 */
const calculateRelevanceScore = (profile, event, pastEvents = [], noShowEvents = []) => {
  const eventType = event.eventType || 'ai-ml';

  let industryScore = 40;
  if (profile.industryIds && profile.industryIds.length > 0) {
      const indScores = profile.industryIds.map(ind => {
          const slug = ind.slug || 'other';
          return (INDUSTRY_EVENT_MATCH[slug] || INDUSTRY_EVENT_MATCH.other)[eventType];
      });
      industryScore = Math.max(...indScores);
  }
  
  let interestScore = 40;
  if (profile.interestIds && profile.interestIds.length > 0) {
    const interestScores = profile.interestIds.map(int => {
      const slug = int.slug || 'ai-ml';
      return (INTEREST_EVENT_MATCH[slug] || INTEREST_EVENT_MATCH['ai-ml'])[eventType];
    });
    interestScore = Math.max(...interestScores);
  }

  const seniorityScore = getSeniorityScore(profile.jobTitle);
  const sizeScore      = COMPANY_SIZE_SCORES[profile.companySize] || 50;
  const completeScore  = getCompletenessScore(profile);

  // Derive past experience score
  let pastExperienceScore = 50;
  if (pastEvents && pastEvents.length > 0) {
    const matchingEvents = pastEvents.filter(e => e && e.eventType === eventType).length;
    pastExperienceScore = Math.min(100, 50 + (matchingEvents * 25));
  }

  // Deduct No-Show Penalty (15 pts per no-show)
  if (noShowEvents && noShowEvents.length > 0) {
    pastExperienceScore = Math.max(0, pastExperienceScore - (noShowEvents.length * 15));
  }

  // Weighted average
  const score =
    industryScore       * 0.25 +
    interestScore       * 0.20 +
    seniorityScore      * 0.20 +
    pastExperienceScore * 0.15 +
    sizeScore           * 0.15 +
    completeScore       * 0.05;

  return Math.min(100, Math.max(0, Math.round(score)));
};

/**
 * Calculate attendee relevance score using AI (Gemini).
 */
const calculateAIRelevanceScore = async (profile, event) => {
  try {
    const aiResult = await analyzeAttendeeRelevance(profile, event);
    return aiResult;
  } catch (error) {
    console.warn('AI Scoring failed, falling back to rule-based scoring:', error.message);
    const fallbackScore = calculateRelevanceScore(profile, event);
    return {
      relevanceScore: fallbackScore,
      relevanceStatus: getRelevanceStatus(fallbackScore),
      analysis: 'Rule-based fallback analysis.',
      engagementPrediction: 50
    };
  }
};

/**
 * Classify relevance status from score.
 */
const getRelevanceStatus = (score) => {
  if (score >= 80) return 'high';
  if (score >= 60) return 'moderate';
  return 'low';
};

/**
 * Calculate sponsor match score for a lead.
 * @param {Object} registration - EventRegistration with relevanceScore
 * @param {Object} profile      - AttendeeProfile
 * @param {Object} sponsorProfile - SponsorProfile
 * @returns {number}            - matchScore 0–100
 */
const calculateMatchScore = (registration, profile, sponsorProfile) => {
  const relevanceScore  = registration.relevanceScore || 50;
  const seniorityScore  = getSeniorityScore(profile.jobTitle);
  const sizeScore       = COMPANY_SIZE_SCORES[profile.companySize] || 50;

  // Industry match against sponsor's target industries
  let industryMatchScore = 40;
  if (sponsorProfile && sponsorProfile.targetIndustries && sponsorProfile.targetIndustries.length > 0) {
    const hasMatch = profile.industryIds?.some(ind => 
      sponsorProfile.targetIndustries.includes(ind.slug) || 
      sponsorProfile.targetIndustries.includes(ind.name)
    );
    industryMatchScore = hasMatch ? 100 : 30;
  }

  const score =
    relevanceScore   * 0.40 +
    industryMatchScore * 0.30 +
    seniorityScore   * 0.20 +
    sizeScore        * 0.10;

  return Math.min(100, Math.max(0, Math.round(score)));
};

/**
 * Get lead quality from match score.
 */
const getLeadQuality = (matchScore) => {
  if (matchScore >= 85) return 'hot';
  if (matchScore >= 60) return 'warm';
  return 'cold';
};

/**
 * Estimate conversion probability based on profile signals.
 */
const calculateConversionProbability = (profile, matchScore) => {
  const seniorityScore = getSeniorityScore(profile.jobTitle);
  const sizeScore      = COMPANY_SIZE_SCORES[profile.companySize] || 50;
  const base = matchScore * 0.6 + seniorityScore * 0.25 + sizeScore * 0.15;
  return Math.min(98, Math.max(5, Math.round(base * 0.9)));
};

/**
 * Estimate deal value range based on company size and seniority.
 */
const estimateDealValue = (profile) => {
  const sizeMap = {
    '1-10':     [5000, 15000],
    '11-50':    [10000, 30000],
    '51-200':   [20000, 50000],
    '201-500':  [30000, 75000],
    '501-1000': [50000, 100000],
    '1000+':    [75000, 250000],
  };
  return sizeMap[profile.companySize] || [5000, 25000];
};

/**
 * Classify attendee by seniority segment (for analytics segmentation chart).
 */
const getSenioritySegment = (jobTitle = '') => {
  const t = jobTitle.toLowerCase();
  if (/\b(ceo|cto|cfo|coo|ciso|cpo|chief|president)\b/.test(t)) return 'C-Level Executives';
  if (/\b(vice president|vp |director)\b/.test(t)) return 'Directors/VPs';
  if (/\b(manager|head of|lead)\b/.test(t)) return 'Managers';
  return 'Individual Contributors';
};

module.exports = {
  calculateRelevanceScore,
  calculateAIRelevanceScore,
  getRelevanceStatus,
  calculateMatchScore,
  getLeadQuality,
  calculateConversionProbability,
  estimateDealValue,
  getSenioritySegment,
};
