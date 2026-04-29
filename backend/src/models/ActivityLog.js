const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['lead_identified', 'attendee_flagged', 'sponsor_interest', 'roi_updated'],
      required: true,
    },
    title:       { type: String, required: true },
    description: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
