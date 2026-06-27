import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['linen', 'toiletries', 'minibar', 'cleaning', 'other'],
      default: 'other',
    },
    unit: { type: String, default: 'unit', trim: true }, // pcs, bottles, kg...
    quantity: { type: Number, required: true, min: 0, default: 0 },
    threshold: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

inventorySchema.virtual('lowStock').get(function () {
  return this.quantity <= this.threshold;
});

inventorySchema.set('toJSON', { virtuals: true });

export default mongoose.model('InventoryItem', inventorySchema);
