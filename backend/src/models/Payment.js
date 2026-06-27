import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    guest: { type: mongoose.Schema.Types.ObjectId, ref: 'Guest', required: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true, default: Date.now },
    mode: { type: String, enum: ['cash', 'card', 'upi'], required: true },
    reference: { type: String, trim: true, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

paymentSchema.index({ guest: 1, date: -1 });

export default mongoose.model('Payment', paymentSchema);
