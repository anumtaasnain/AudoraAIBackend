const mongoose = require('mongoose');

const engagementMetricSchema = new mongoose.Schema(
  {
    eventId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    month:          { type: Date, required: true },   // First day of the month
    engagementRate: { type: Number, required: true },  // Actual %
    predictedRate:  { type: Number },                  // AI-predicted %
  },
  { timestamps: true }
);

engagementMetricSchema.index({ eventId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('EngagementMetric', engagementMetricSchema);
