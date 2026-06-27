import mongoose from 'mongoose';

const guestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    idNumber: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    roomNumber: { type: String, required: true }, // denormalised for fast search/report
    dailyRate: { type: Number, required: true, min: 0 },
    checkInDate: { type: Date, required: true },
    expectedCheckOutDate: { type: Date, required: true },
    actualCheckOutDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['checked-in', 'checked-out'],
      default: 'checked-in',
    },
    // financials
    totalCharges: { type: Number, default: 0, min: 0 }, // computed at checkout / on demand
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

guestSchema.index({ name: 'text', roomNumber: 'text', idNumber: 'text' });

export default mongoose.model('Guest', guestSchema);
