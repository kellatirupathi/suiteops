import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String }, // denormalised so log survives user changes
    action: { type: String, required: true }, // e.g. CHECK_IN, CHECK_OUT, PAYMENT, INVENTORY_UPDATE
    entity: { type: String }, // Guest / Payment / InventoryItem / Room
    entityId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: String, default: '' },
  },
  { timestamps: true }
);

activitySchema.index({ createdAt: -1 });

export default mongoose.model('ActivityLog', activitySchema);
