import InventoryItem from '../models/InventoryItem.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/activity.js';

export const listInventory = asyncHandler(async (req, res) => {
  const { lowOnly } = req.query;
  let items = await InventoryItem.find().sort({ category: 1, name: 1 });
  if (lowOnly === 'true') {
    items = items.filter((i) => i.quantity <= i.threshold);
  }
  res.json(items);
});

export const createItem = asyncHandler(async (req, res) => {
  const { name, category, unit, quantity, threshold } = req.body;
  if (!name) throw new ApiError(400, 'name is required');
  const item = await InventoryItem.create({
    name,
    category,
    unit,
    quantity: quantity ?? 0,
    threshold: threshold ?? 0,
  });
  await logActivity(req, {
    action: 'INVENTORY_CREATE',
    entity: 'InventoryItem',
    entityId: item._id,
    details: `Added inventory item ${item.name}`,
  });
  res.status(201).json(item);
});

export const updateItem = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Item not found');
  const { name, category, unit, quantity, threshold } = req.body;
  if (name !== undefined) item.name = name;
  if (category !== undefined) item.category = category;
  if (unit !== undefined) item.unit = unit;
  if (quantity !== undefined) item.quantity = quantity;
  if (threshold !== undefined) item.threshold = threshold;
  await item.save();
  await logActivity(req, {
    action: 'INVENTORY_UPDATE',
    entity: 'InventoryItem',
    entityId: item._id,
    details: `Updated ${item.name} -> qty ${item.quantity}`,
  });
  res.json(item);
});

// PATCH /api/inventory/:id/adjust  { delta: number }
export const adjustStock = asyncHandler(async (req, res) => {
  const delta = Number(req.body.delta);
  if (Number.isNaN(delta)) throw new ApiError(400, 'delta must be a number');
  const item = await InventoryItem.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Item not found');
  item.quantity = Math.max(0, item.quantity + delta);
  await item.save();
  await logActivity(req, {
    action: 'INVENTORY_ADJUST',
    entity: 'InventoryItem',
    entityId: item._id,
    details: `${delta >= 0 ? '+' : ''}${delta} ${item.name} -> ${item.quantity}`,
  });
  res.json(item);
});

export const deleteItem = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, 'Item not found');
  await logActivity(req, {
    action: 'INVENTORY_DELETE',
    entity: 'InventoryItem',
    entityId: item._id,
    details: `Deleted ${item.name}`,
  });
  res.json({ message: 'Item deleted' });
});
