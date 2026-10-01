-- Create notifications table
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  celular TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'falha')),
  tentativas INTEGER DEFAULT 0,
  proxima_tentativa TIMESTAMP WITH TIME ZONE,
  enviado_em TIMESTAMP WITH TIME ZONE,
  erro_mensagem TEXT,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CREATED_AT TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_notificacoes_aluno_id ON notificacoes(aluno_id);
CREATE INDEX idx_notificacoes_status ON notificacoes(status);
CREATE INDEX idx_notificacoes_tipo ON notificacoes(tipo);
CREATE INDEX idx_notificacoes_data_criacao ON notificacoes(data_criacao DESC);

-- Add RLS (Row Level Security)
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notificacoes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM alunos
      WHERE alunos.id = notificacoes.aluno_id
      AND auth.uid() = alunos.user_id
    )
  );

-- Allow service role to insert/update notifications
CREATE POLICY "Service role can manage notifications"
  ON notificacoes
  FOR ALL
  USING (auth.role() = 'service_role');
