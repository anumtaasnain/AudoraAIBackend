const mongoose = require('mongoose');

const sponsorLeadSchema = new mongoose.Schema(
  {
    sponsorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    attendeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },

    // AI-Computed Scores
    matchScore:             { type: Number, min: 0, max: 100 },
    conversionProbability:  { type: Number, min: 0, max: 100 },
    estimatedValueMin:      { type: Number },   // in USD
    estimatedValueMax:      { type: Number },   // in USD

    // Lead Classification
    leadQuality: {
      type: String,
      enum: ['hot', 'warm', 'cold'],
    },
    previousEngagement: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
    },

    // Embedded interests array (replaces separate lead_interests table)
    interests: [{ type: String }],

    // Status
    status: {
      type: String,
      enum: ['new', 'viewed', 'contacted', 'converted', 'rejected'],
      default: 'new',
    },
  },
  { timestamps: true }
);

// Compound unique index
sponsorLeadSchema.index({ sponsorId: 1, attendeeId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('SponsorLead', sponsorLeadSchema);
