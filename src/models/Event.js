const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title:       { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    interestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventInterest',
      required: true,
    },
    industryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Industry',
    },
    location:  { type: String, trim: true },
    startsAt:  { type: Date },
    endsAt:    { type: Date },
    isActive:  { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['pending_admin', 'pending_sponsor', 'approved', 'rejected'],
      default: 'approved',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
