-- Hospital ERP Seed Data
-- Initial data for Hospital Management System

-- Insert default system settings
INSERT INTO system_settings (key, value, description, category, is_public) VALUES
('hospital_name', 'General Hospital', 'Name of the hospital', 'general', true),
('hospital_address', '123 Medical Center Drive, City, State 12345', 'Hospital address', 'general', true),
('hospital_phone', '+1-555-0123', 'Hospital main phone number', 'general', true),
('hospital_email', 'info@generalhospital.com', 'Hospital main email', 'general', true),
('working_hours', '{"monday": "08:00-18:00", "tuesday": "08:00-18:00", "wednesday": "08:00-18:00", "thursday": "08:00-18:00", "friday": "08:00-18:00", "saturday": "09:00-14:00", "sunday": "closed"}', 'Hospital working hours', 'general', true),
('appointment_duration', '30', 'Default appointment duration in minutes', 'appointments', false),
('max_appointments_per_day', '20', 'Maximum appointments per doctor per day', 'appointments', false),
('currency', 'USD', 'Default currency', 'billing', true),
('tax_rate', '0.10', 'Default tax rate (10%)', 'billing', false),
('low_stock_threshold', '10', 'Minimum stock level alert threshold', 'inventory', false),
('backup_retention_days', '30', 'Number of days to retain backups', 'system', false);

-- Insert departments
INSERT INTO departments (id, name, description, location, phone, email, budget) VALUES
(uuid_generate_v4(), 'Emergency', 'Emergency Department', 'Ground Floor, Wing A', '+1-555-0124', 'emergency@generalhospital.com', 500000.00),
(uuid_generate_v4(), 'Cardiology', 'Heart and Cardiovascular Department', '2nd Floor, Wing B', '+1-555-0125', 'cardiology@generalhospital.com', 750000.00),
(uuid_generate_v4(), 'Neurology', 'Brain and Nervous System Department', '3rd Floor, Wing C', '+1-555-0126', 'neurology@generalhospital.com', 600000.00),
(uuid_generate_v4(), 'Orthopedics', 'Bone and Joint Department', '1st Floor, Wing D', '+1-555-0127', 'orthopedics@generalhospital.com', 550000.00),
(uuid_generate_v4(), 'Pediatrics', 'Children''s Department', '2nd Floor, Wing A', '+1-555-0128', 'pediatrics@generalhospital.com', 400000.00),
(uuid_generate_v4(), 'Radiology', 'Medical Imaging Department', 'Basement, Wing B', '+1-555-0129', 'radiology@generalhospital.com', 800000.00),
(uuid_generate_v4(), 'Laboratory', 'Clinical Laboratory', 'Basement, Wing A', '+1-555-0130', 'lab@generalhospital.com', 300000.00),
(uuid_generate_v4(), 'Pharmacy', 'Hospital Pharmacy', 'Ground Floor, Wing C', '+1-555-0131', 'pharmacy@generalhospital.com', 200000.00),
(uuid_generate_v4(), 'Administration', 'Hospital Administration', '4th Floor, Wing A', '+1-555-0132', 'admin@generalhospital.com', 150000.00),
(uuid_generate_v4(), 'Human Resources', 'HR Department', '4th Floor, Wing B', '+1-555-0133', 'hr@generalhospital.com', 100000.00);

-- Insert default admin user (password: admin123 - hashed with bcrypt)
INSERT INTO users (id, email, password, first_name, last_name, role, department, permissions, phone, address, hire_date, salary) VALUES
(uuid_generate_v4(), 'admin@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'System', 'Administrator', 'admin', 'Administration', '["all"]', '+1-555-0100', '123 Admin Street, City, State', '2024-01-01', 80000.00);

-- Insert sample doctors
INSERT INTO users (id, email, password, first_name, last_name, role, department, permissions, phone, address, hire_date, salary) VALUES
(uuid_generate_v4(), 'dr.smith@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'John', 'Smith', 'doctor', 'Cardiology', '["view_patients", "create_appointments", "view_medical_records", "create_medical_records", "create_prescriptions"]', '+1-555-0101', '456 Doctor Lane, City, State', '2023-03-15', 150000.00),
(uuid_generate_v4(), 'dr.johnson@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Sarah', 'Johnson', 'doctor', 'Neurology', '["view_patients", "create_appointments", "view_medical_records", "create_medical_records", "create_prescriptions"]', '+1-555-0102', '789 Medical Ave, City, State', '2023-06-01', 145000.00),
(uuid_generate_v4(), 'dr.brown@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Michael', 'Brown', 'doctor', 'Emergency', '["view_patients", "create_appointments", "view_medical_records", "create_medical_records", "create_prescriptions", "emergency_access"]', '+1-555-0103', '321 Emergency Blvd, City, State', '2023-01-10', 160000.00),
(uuid_generate_v4(), 'dr.davis@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Emily', 'Davis', 'doctor', 'Pediatrics', '["view_patients", "create_appointments", "view_medical_records", "create_medical_records", "create_prescriptions"]', '+1-555-0104', '654 Children Way, City, State', '2023-09-20', 140000.00);

-- Insert sample nurses
INSERT INTO users (id, email, password, first_name, last_name, role, department, permissions, phone, address, hire_date, salary) VALUES
(uuid_generate_v4(), 'nurse.wilson@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Lisa', 'Wilson', 'nurse', 'Emergency', '["view_patients", "view_appointments", "view_medical_records", "update_patient_vitals"]', '+1-555-0105', '987 Nurse Street, City, State', '2023-02-14', 65000.00),
(uuid_generate_v4(), 'nurse.garcia@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Maria', 'Garcia', 'nurse', 'Cardiology', '["view_patients", "view_appointments", "view_medical_records", "update_patient_vitals"]', '+1-555-0106', '147 Care Ave, City, State', '2023-04-05', 62000.00);

-- Insert sample pharmacist
INSERT INTO users (id, email, password, first_name, last_name, role, department, permissions, phone, address, hire_date, salary) VALUES
(uuid_generate_v4(), 'pharmacist.lee@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'David', 'Lee', 'pharmacist', 'Pharmacy', '["view_prescriptions", "dispense_medications", "manage_inventory", "view_patients"]', '+1-555-0107', '258 Pharmacy Road, City, State', '2023-05-12', 75000.00);

-- Insert sample lab technician
INSERT INTO users (id, email, password, first_name, last_name, role, department, permissions, phone, address, hire_date, salary) VALUES
(uuid_generate_v4(), 'lab.tech@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Jennifer', 'Martinez', 'lab_tech', 'Laboratory', '["view_lab_orders", "process_lab_tests", "enter_lab_results", "view_patients"]', '+1-555-0108', '369 Lab Lane, City, State', '2023-07-18', 55000.00);

-- Insert sample radiologist
INSERT INTO users (id, email, password, first_name, last_name, role, department, permissions, phone, address, hire_date, salary) VALUES
(uuid_generate_v4(), 'radiologist.kim@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'James', 'Kim', 'radiologist', 'Radiology', '["view_imaging_orders", "process_imaging", "create_radiology_reports", "view_patients"]', '+1-555-0109', '741 Radiology Blvd, City, State', '2023-08-22', 180000.00);

-- Insert sample HR staff
INSERT INTO users (id, email, password, first_name, last_name, role, department, permissions, phone, address, hire_date, salary) VALUES
(uuid_generate_v4(), 'hr.manager@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Amanda', 'Taylor', 'hr', 'Human Resources', '["manage_employees", "view_payroll", "manage_attendance", "manage_leave_requests"]', '+1-555-0110', '852 HR Avenue, City, State', '2023-01-05', 70000.00);

-- Insert sample finance staff
INSERT INTO users (id, email, password, first_name, last_name, role, department, permissions, phone, address, hire_date, salary) VALUES
(uuid_generate_v4(), 'finance.manager@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Robert', 'Anderson', 'finance', 'Administration', '["manage_billing", "view_payments", "generate_reports", "manage_insurance"]', '+1-555-0111', '963 Finance Street, City, State', '2023-02-28', 75000.00);

-- Insert sample receptionist
INSERT INTO users (id, email, password, first_name, last_name, role, department, permissions, phone, address, hire_date, salary) VALUES
(uuid_generate_v4(), 'reception@generalhospital.com', '$2b$10$rOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQjQjQjQjOzJqQjQjQjQjQ', 'Jessica', 'White', 'receptionist', 'Administration', '["view_patients", "create_appointments", "view_appointments", "register_patients"]', '+1-555-0112', '159 Reception Road, City, State', '2023-04-15', 40000.00);

-- Insert sample patients
INSERT INTO patients (id, first_name, last_name, date_of_birth, gender, phone, email, address, emergency_contact, insurance_info, blood_type) VALUES
(uuid_generate_v4(), 'Alice', 'Cooper', '1985-03-15', 'female', '+1-555-1001', 'alice.cooper@email.com', '123 Patient Street, City, State 12345', '{"name": "Bob Cooper", "relationship": "Spouse", "phone": "+1-555-1002"}', '{"provider": "Blue Cross", "policy_number": "BC123456789", "group_number": "GRP001"}', 'A+'),
(uuid_generate_v4(), 'Bob', 'Johnson', '1978-07-22', 'male', '+1-555-1003', 'bob.johnson@email.com', '456 Health Ave, City, State 12345', '{"name": "Mary Johnson", "relationship": "Wife", "phone": "+1-555-1004"}', '{"provider": "Aetna", "policy_number": "AET987654321", "group_number": "GRP002"}', 'B+'),
(uuid_generate_v4(), 'Carol', 'Smith', '1992-11-08', 'female', '+1-555-1005', 'carol.smith@email.com', '789 Wellness Blvd, City, State 12345', '{"name": "David Smith", "relationship": "Brother", "phone": "+1-555-1006"}', '{"provider": "Cigna", "policy_number": "CIG456789123", "group_number": "GRP003"}', 'O-'),
(uuid_generate_v4(), 'David', 'Brown', '1965-12-03', 'male', '+1-555-1007', 'david.brown@email.com', '321 Medical Lane, City, State 12345', '{"name": "Susan Brown", "relationship": "Wife", "phone": "+1-555-1008"}', '{"provider": "United Healthcare", "policy_number": "UHC789123456", "group_number": "GRP004"}', 'AB+'),
(uuid_generate_v4(), 'Emma', 'Davis', '2010-05-18', 'female', '+1-555-1009', 'parent.davis@email.com', '654 Family Street, City, State 12345', '{"name": "John Davis", "relationship": "Father", "phone": "+1-555-1010"}', '{"provider": "Kaiser Permanente", "policy_number": "KP123789456", "group_number": "GRP005"}', 'A-');

-- Insert sample medications
INSERT INTO medications (id, name, generic_name, brand_name, dosage, form, manufacturer, description, price) VALUES
(uuid_generate_v4(), 'Acetaminophen', 'Acetaminophen', 'Tylenol', '500mg', 'tablet', 'Johnson & Johnson', 'Pain reliever and fever reducer', 0.25),
(uuid_generate_v4(), 'Ibuprofen', 'Ibuprofen', 'Advil', '200mg', 'tablet', 'Pfizer', 'Anti-inflammatory pain reliever', 0.30),
(uuid_generate_v4(), 'Amoxicillin', 'Amoxicillin', 'Amoxil', '500mg', 'capsule', 'GlaxoSmithKline', 'Antibiotic for bacterial infections', 1.50),
(uuid_generate_v4(), 'Lisinopril', 'Lisinopril', 'Prinivil', '10mg', 'tablet', 'Merck', 'ACE inhibitor for high blood pressure', 0.75),
(uuid_generate_v4(), 'Metformin', 'Metformin', 'Glucophage', '500mg', 'tablet', 'Bristol-Myers Squibb', 'Diabetes medication', 0.50),
(uuid_generate_v4(), 'Atorvastatin', 'Atorvastatin', 'Lipitor', '20mg', 'tablet', 'Pfizer', 'Cholesterol-lowering medication', 2.00),
(uuid_generate_v4(), 'Omeprazole', 'Omeprazole', 'Prilosec', '20mg', 'capsule', 'AstraZeneca', 'Proton pump inhibitor for acid reflux', 1.25),
(uuid_generate_v4(), 'Albuterol', 'Albuterol', 'ProAir', '90mcg', 'inhaler', 'Teva', 'Bronchodilator for asthma', 25.00);

-- Insert sample inventory for medications
INSERT INTO inventory (medication_id, batch_number, quantity, unit_price, expiry_date, supplier, location) 
SELECT 
    m.id,
    'BATCH' || LPAD((ROW_NUMBER() OVER())::TEXT, 6, '0'),
    FLOOR(RANDOM() * 500 + 100)::INTEGER,
    m.price,
    CURRENT_DATE + INTERVAL '2 years',
    'Medical Supply Co.',
    'Pharmacy Storage'
FROM medications m;

-- Insert sample lab tests
INSERT INTO lab_tests (id, name, category, description, normal_range, unit, price) VALUES
(uuid_generate_v4(), 'Complete Blood Count', 'Hematology', 'Comprehensive blood analysis', 'Various ranges', 'Multiple', 45.00),
(uuid_generate_v4(), 'Basic Metabolic Panel', 'Chemistry', 'Basic blood chemistry panel', 'Various ranges', 'Multiple', 35.00),
(uuid_generate_v4(), 'Lipid Panel', 'Chemistry', 'Cholesterol and triglycerides', 'Total Chol: <200 mg/dL', 'mg/dL', 40.00),
(uuid_generate_v4(), 'Thyroid Function', 'Endocrinology', 'TSH and thyroid hormones', 'TSH: 0.4-4.0 mIU/L', 'mIU/L', 55.00),
(uuid_generate_v4(), 'Hemoglobin A1C', 'Chemistry', 'Average blood sugar over 3 months', '<5.7%', '%', 30.00),
(uuid_generate_v4(), 'Urinalysis', 'Urinalysis', 'Comprehensive urine analysis', 'Various parameters', 'Multiple', 25.00),
(uuid_generate_v4(), 'Liver Function Panel', 'Chemistry', 'Liver enzyme tests', 'ALT: 7-56 U/L', 'U/L', 50.00);

-- Insert sample imaging types
INSERT INTO imaging_types (id, name, category, description, price) VALUES
(uuid_generate_v4(), 'Chest X-Ray', 'X-Ray', 'Standard chest radiograph', 150.00),
(uuid_generate_v4(), 'CT Scan - Head', 'CT', 'Computed tomography of head', 800.00),
(uuid_generate_v4(), 'MRI - Brain', 'MRI', 'Magnetic resonance imaging of brain', 1200.00),
(uuid_generate_v4(), 'Ultrasound - Abdominal', 'Ultrasound', 'Abdominal ultrasound examination', 300.00),
(uuid_generate_v4(), 'Mammography', 'X-Ray', 'Breast cancer screening', 250.00),
(uuid_generate_v4(), 'Echocardiogram', 'Ultrasound', 'Heart ultrasound', 400.00),
(uuid_generate_v4(), 'Bone Density Scan', 'DEXA', 'Osteoporosis screening', 200.00);

-- Insert sample appointments (for the next 30 days)
DO $$
DECLARE
    patient_ids UUID[];
    doctor_ids UUID[];
    i INTEGER;
    appointment_date TIMESTAMP;
BEGIN
    -- Get patient and doctor IDs
    SELECT ARRAY(SELECT id FROM patients LIMIT 5) INTO patient_ids;
    SELECT ARRAY(SELECT id FROM users WHERE role = 'doctor' LIMIT 4) INTO doctor_ids;
    
    -- Create appointments for the next 30 days
    FOR i IN 1..20 LOOP
        appointment_date := CURRENT_DATE + (RANDOM() * 30)::INTEGER + 
                           (FLOOR(RANDOM() * 8 + 9) || ' hours')::INTERVAL + 
                           (FLOOR(RANDOM() * 4) * 15 || ' minutes')::INTERVAL;
        
        INSERT INTO appointments (
            patient_id, 
            doctor_id, 
            appointment_date, 
            type, 
            status, 
            notes,
            room_number
        ) VALUES (
            patient_ids[1 + (i % array_length(patient_ids, 1))],
            doctor_ids[1 + (i % array_length(doctor_ids, 1))],
            appointment_date,
            (ARRAY['consultation', 'follow_up', 'checkup'])[1 + (i % 3)],
            (ARRAY['scheduled', 'confirmed'])[1 + (i % 2)],
            'Regular appointment',
            'Room ' || (100 + (i % 20))
        );
    END LOOP;
END $$;

-- Insert sample medical records
DO $$
DECLARE
    patient_ids UUID[];
    doctor_ids UUID[];
    i INTEGER;
BEGIN
    SELECT ARRAY(SELECT id FROM patients LIMIT 5) INTO patient_ids;
    SELECT ARRAY(SELECT id FROM users WHERE role = 'doctor' LIMIT 4) INTO doctor_ids;
    
    FOR i IN 1..10 LOOP
        INSERT INTO medical_records (
            patient_id,
            doctor_id,
            diagnosis,
            symptoms,
            treatment,
            medications,
            notes,
            visit_date
        ) VALUES (
            patient_ids[1 + (i % array_length(patient_ids, 1))],
            doctor_ids[1 + (i % array_length(doctor_ids, 1))],
            (ARRAY['Hypertension', 'Diabetes Type 2', 'Common Cold', 'Migraine', 'Anxiety'])[1 + (i % 5)],
            '["headache", "fatigue", "dizziness"]',
            'Prescribed medication and lifestyle changes',
            '[{"name": "Lisinopril", "dosage": "10mg", "frequency": "once daily"}]',
            'Patient responded well to treatment',
            CURRENT_TIMESTAMP - (RANDOM() * 90 || ' days')::INTERVAL
        );
    END LOOP;
END $$;

-- Insert sample bills
DO $$
DECLARE
    patient_ids UUID[];
    i INTEGER;
    bill_id UUID;
BEGIN
    SELECT ARRAY(SELECT id FROM patients LIMIT 5) INTO patient_ids;
    
    FOR i IN 1..8 LOOP
        bill_id := uuid_generate_v4();
        
        INSERT INTO bills (
            id,
            patient_id,
            total_amount,
            paid_amount,
            status,
            due_date,
            notes
        ) VALUES (
            bill_id,
            patient_ids[1 + (i % array_length(patient_ids, 1))],
            ROUND((RANDOM() * 1000 + 100)::NUMERIC, 2),
            CASE WHEN i % 3 = 0 THEN 0 ELSE ROUND((RANDOM() * 500 + 50)::NUMERIC, 2) END,
            (ARRAY['pending', 'paid', 'partial'])[1 + (i % 3)],
            CURRENT_DATE + (RANDOM() * 30)::INTEGER,
            'Medical services bill'
        );
        
        -- Add bill items
        INSERT INTO bill_items (bill_id, description, quantity, unit_price, total_price, item_type) VALUES
        (bill_id, 'Consultation Fee', 1, 150.00, 150.00, 'consultation'),
        (bill_id, 'Lab Tests', 2, 45.00, 90.00, 'lab_test');
    END LOOP;
END $$;

-- Update bill totals
UPDATE bills SET total_amount = (
    SELECT COALESCE(SUM(total_price), 0) 
    FROM bill_items 
    WHERE bill_items.bill_id = bills.id
);

-- Insert sample notifications
DO $$
DECLARE
    user_ids UUID[];
    i INTEGER;
BEGIN
    SELECT ARRAY(SELECT id FROM users LIMIT 10) INTO user_ids;
    
    FOR i IN 1..15 LOOP
        INSERT INTO notifications (
            user_id,
            title,
            message,
            type,
            is_read
        ) VALUES (
            user_ids[1 + (i % array_length(user_ids, 1))],
            (ARRAY['New Appointment', 'Lab Results Ready', 'System Update', 'Payment Received'])[1 + (i % 4)],
            (ARRAY[
                'You have a new appointment scheduled',
                'Lab results are ready for review',
                'System will be updated tonight',
                'Payment has been processed successfully'
            ])[1 + (i % 4)],
            (ARRAY['info', 'success', 'warning', 'success'])[1 + (i % 4)],
            i % 3 = 0
        );
    END LOOP;
END $$;