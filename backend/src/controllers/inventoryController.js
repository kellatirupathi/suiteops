import { supabase } from '../config/supabase.js';
import { asyncHandler, ApiError } from '../middleware/error.js';
import { logActivity } from '../utils/activity.js';
import { mapInventory, newId } from '../utils/map.js';

export const listInventory = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new ApiError(400, error.message);
  let items = (data || []).map(mapInventory);
  if (req.query.lowOnly === 'true') items = items.filter((i) => i.quantity <= i.threshold);
  res.json(items);
});

export const createItem = asyncHandler(async (req, res) => {
  const { name, category, unit, quantity, threshold } = req.body;
  if (!name) throw new ApiError(400, 'name is required');
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      id: newId(),
      name,
      category: category || 'other',
      unit: unit || 'unit',
      quantity: quantity ?? 0,
      threshold: threshold ?? 0,
    })
    .select()
    .single();
  if (error) throw new ApiError(400, error.message);
  const item = mapInventory(data);
  await logActivity(req, {
    action: 'INVENTORY_CREATE',
    entity: 'InventoryItem',
    entityId: item._id,
    details: `Added inventory item ${item.name}`,
  });
  res.status(201).json(item);
});

export const updateItem = asyncHandler(async (req, res) => {
  const { name, category, unit, quantity, threshold } = req.body;
  const patch = { updated_at: new Date().toISOString() };
  if (name !== undefined) patch.name = name;
  if (category !== undefined) patch.category = category;
  if (unit !== undefined) patch.unit = unit;
  if (quantity !== undefined) patch.quantity = Number(quantity);
  if (threshold !== undefined) patch.threshold = Number(threshold);

  const { data, error } = await supabase
    .from('inventory_items')
    .update(patch)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error || !data) throw new ApiError(404, 'Item not found');
  const item = mapInventory(data);
  await logActivity(req, {
    action: 'INVENTORY_UPDATE',
    entity: 'InventoryItem',
    entityId: item._id,
    details: `Updated ${item.name} -> qty ${item.quantity}`,
  });
  res.json(item);
});

// PATCH /api/inventory/:id/adjust  { delta }
export const adjustStock = asyncHandler(async (req, res) => {
  const delta = Number(req.body.delta);
  if (Number.isNaN(delta)) throw new ApiError(400, 'delta must be a number');

  const { data, error } = await supabase.rpc('adjust_stock', {
    p_item_id: req.params.id,
    p_delta: delta,
  });
  if (error) throw new ApiError(400, error.message);
  if (!data || !data.length) throw new ApiError(404, 'Item not found');

  const item = mapInventory(data[0]);
  await logActivity(req, {
    action: 'INVENTORY_ADJUST',
    entity: 'InventoryItem',
    entityId: item._id,
    details: `${delta >= 0 ? '+' : ''}${delta} ${item.name} -> ${item.quantity}`,
  });
  res.json(item);
});

export const deleteItem = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', req.params.id)
    .select()
    .single();
  if (error || !data) throw new ApiError(404, 'Item not found');
  await logActivity(req, {
    action: 'INVENTORY_DELETE',
    entity: 'InventoryItem',
    entityId: data.id,
    details: `Deleted ${data.name}`,
  });
  res.json({ message: 'Item deleted' });
});
