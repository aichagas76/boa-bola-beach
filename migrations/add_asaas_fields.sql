-- Adicionar campos Asaas à tabela de pagamentos
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS asaas_payment_id VARCHAR(50);
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(50);
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS asaas_payment_url TEXT;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'manual';
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'pending';

-- Criar tabela de clientes Asaas
CREATE TABLE IF NOT EXISTS asaas_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asaas_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  cpf VARCHAR(20),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_asaas_customers_asaas_id ON asaas_customers(asaas_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_asaas_payment_id ON pagamentos(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_asaas_customer_id ON pagamentos(asaas_customer_id);

-- RLS para tabela de clientes Asaas
ALTER TABLE asaas_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asaas_customers_read" ON asaas_customers
  FOR SELECT USING (true);

CREATE POLICY "asaas_customers_insert" ON asaas_customers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "asaas_customers_update" ON asaas_customers
  FOR UPDATE USING (true);
