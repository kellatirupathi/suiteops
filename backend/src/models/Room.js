import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, trim: true },
    type: { type: String, required: true, trim: true }, // e.g. Standard, Deluxe, Suite
    dailyRate: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance'],
      default: 'available',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Room', roomSchema);
