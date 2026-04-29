const mongoose = require('mongoose');

const eventRegistrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // AI Scoring
    relevanceScore:  { type: Number, min: 0, max: 100, default: null },
    relevanceStatus: {
      type: String,
      enum: ['high', 'moderate', 'low'],
      default: null,
    },
    scoringVersion:  { type: String, default: 'v1' },
    aiAnalysis:      { type: String },
    engagementPrediction: { type: Number, min: 0, max: 100 },

    // Engagement
    engagementScore:  { type: Number, default: 0 },
    isQualifiedLead:  { type: Boolean, default: false },
    isConverted:      { type: Boolean, default: false },

    status: {
      type: String,
      enum: ['pending_admin', 'pending_organizer', 'approved', 'rejected'],
      default: 'pending_admin',
    },

    attendanceStatus: {
      type: String,
      enum: ['pending', 'attended', 'no_show'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Compound unique index: one registration per (event, user)
eventRegistrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

// Auto-derive relevanceStatus from relevanceScore before save
eventRegistrationSchema.pre('save', function (next) {
  if (this.relevanceScore !== null && this.relevanceScore !== undefined) {
    if (this.relevanceScore >= 80)      this.relevanceStatus = 'high';
    else if (this.relevanceScore >= 60) this.relevanceStatus = 'moderate';
    else                                this.relevanceStatus = 'low';
  }
  next();
});

module.exports = mongoose.model('EventRegistration', eventRegistrationSchema);
