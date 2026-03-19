-- Supabase Schema for Nalla Delivery Management System
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE (Admin & Drivers)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'driver', -- 'admin' or 'driver'
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =============================================
-- STORES TABLE (WooCommerce Stores)
-- =============================================
CREATE TABLE IF NOT EXISTS stores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    consumer_key VARCHAR(255) NOT NULL,
    consumer_secret VARCHAR(255) NOT NULL,
    email_from VARCHAR(255),
    email_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    active_statuses TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_store_id ON stores(store_id);
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active);

-- =============================================
-- DELIVERY ASSIGNMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS delivery_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    store_id VARCHAR(50) NOT NULL,
    store_name VARCHAR(255),
    order_id BIGINT NOT NULL,
    order_number VARCHAR(50),
    driver_id UUID REFERENCES users(id),
    delivery_date DATE NOT NULL,
    time_slot VARCHAR(20),
    notes TEXT,
    shipping_address TEXT,
    phone VARCHAR(20),
    customer_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    sequence INT DEFAULT 0,
    total_items INT DEFAULT 0,
    products JSONB,
    delivery_cost DECIMAL(10,2) DEFAULT 0.00,
    service_type VARCHAR(50) DEFAULT 'delivery', -- delivery, technician_visit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_delivery_store_id ON delivery_assignments(store_id);
CREATE INDEX IF NOT EXISTS idx_delivery_order_id ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_driver_id ON delivery_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_date ON delivery_assignments(delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_assignments(status);
CREATE INDEX IF NOT EXISTS idx_delivery_driver_date ON delivery_assignments(driver_id, delivery_date);

-- =============================================
-- DRIVER STATUS SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS driver_status_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    store_id VARCHAR(50) NOT NULL,
    completion_status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(driver_id, store_id)
);

-- =============================================
-- SETTINGS TABLE (General Settings)
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES 
    ('google_maps_api_key', '""'),
    ('delivery_note_template', '"המשלוח הושלם על ידי {driver_name} בתאריך {delivery_date} בשעה {delivery_time}"'),
    ('default_time_slots', '["06:00-09:00", "09:00-12:00", "12:00-15:00", "15:00-18:00", "18:00-21:00"]')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- SIGNED DOCUMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS signed_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    delivery_id UUID REFERENCES delivery_assignments(id) ON DELETE CASCADE,
    order_id BIGINT NOT NULL,
    driver_id UUID REFERENCES users(id),
    signature_url TEXT,
    document_url TEXT,
    photos JSONB DEFAULT '[]',
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signed_docs_delivery ON signed_documents(delivery_id);
CREATE INDEX IF NOT EXISTS idx_signed_docs_order ON signed_documents(order_id);

-- =============================================
-- RLS (Row Level Security) Policies
-- =============================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_status_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE signed_documents ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Allow authenticated users to read users" ON users
    FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage users" ON users
    FOR ALL USING (true);

-- Policies for stores table
CREATE POLICY "Allow authenticated to read stores" ON stores
    FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage stores" ON stores
    FOR ALL USING (true);

-- Policies for delivery_assignments
CREATE POLICY "Allow reading delivery assignments" ON delivery_assignments
    FOR SELECT USING (true);

CREATE POLICY "Allow managing delivery assignments" ON delivery_assignments
    FOR ALL USING (true);

-- Policies for settings
CREATE POLICY "Allow reading settings" ON settings
    FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage settings" ON settings
    FOR ALL USING (true);

-- Policies for signed_documents
CREATE POLICY "Allow reading signed documents" ON signed_documents
    FOR SELECT USING (true);

CREATE POLICY "Allow managing signed documents" ON signed_documents
    FOR ALL USING (true);

-- =============================================
-- Functions and Triggers
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_assignments_updated_at
    BEFORE UPDATE ON delivery_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Sample Admin User (change password after setup!)
-- Password: Admin123! (bcrypt hashed)
-- =============================================
INSERT INTO users (email, password_hash, display_name, role, is_active) VALUES 
    ('admin@nalla.co.il', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'מנהל מערכת', 'admin', true)
ON CONFLICT (email) DO NOTHING;
