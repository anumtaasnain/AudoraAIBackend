const mongoose = require('mongoose');

const leadRequestSchema = new mongoose.Schema(
  {
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    requestedLeadCount: {
      type: Number,
      required: true,
      min: 1,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    stripeSessionId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'assigned'],
      default: 'pending',
    },
    assignedLeads: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeadRequest', leadRequestSchema);
