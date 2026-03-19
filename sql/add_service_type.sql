-- =============================================
-- ADD SERVICE TYPE FOR DELIVERY VS TECHNICIAN VISIT
-- =============================================

-- Add service_type column to delivery_assignments
-- Values: 'delivery' (default), 'technician_visit'
ALTER TABLE delivery_assignments 
ADD COLUMN IF NOT EXISTS service_type VARCHAR(50) DEFAULT 'delivery';

-- Add default costs per service type to settings
-- Note: value is JSONB, so we store numbers directly
INSERT INTO settings (key, value) VALUES
    ('default_delivery_cost', '50'),
    ('default_technician_cost', '30'),
    ('technician_note_template', '"שלום {customer_name},\n\nביקור הטכנאי שלך (הזמנה #{order_number}) הושלם בהצלחה!\n\nפרטי הביקור:\n📅 תאריך: {delivery_date}\n⏰ טווח שעות: {time_slot}\n🔧 טכנאי: {driver_name}\n📞 טלפון: {driver_phone}\n\nתודה שבחרת ב-{store_name}!"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create index for service_type queries (useful for reports)
CREATE INDEX IF NOT EXISTS idx_delivery_service_type ON delivery_assignments(service_type);

-- Create reports view for easy querying
CREATE OR REPLACE VIEW delivery_reports AS
SELECT 
    da.id,
    da.store_id,
    da.store_name,
    da.order_id,
    da.order_number,
    da.driver_id,
    u.display_name as driver_name,
    da.delivery_date,
    da.time_slot,
    da.shipping_address,
    da.customer_name,
    da.phone,
    da.status,
    da.service_type,
    da.delivery_cost,
    da.total_items,
    da.completed_at,
    da.created_at
FROM delivery_assignments da
LEFT JOIN users u ON da.driver_id = u.id;

-- Comment for documentation
COMMENT ON COLUMN delivery_assignments.service_type IS 'Type of service: delivery or technician_visit';
COMMENT ON COLUMN delivery_assignments.delivery_cost IS 'Cost charged for this delivery/service';
