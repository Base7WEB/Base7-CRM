-- Habilita Realtime (postgres_changes) na tabela messages, pra a tela de
-- conversa do lead atualizar sozinha quando o agente local confirma o
-- envio ou uma resposta chega -- sem precisar dar refresh manual.
-- RLS de messages continua valendo pra quem pode assinar/receber os
-- eventos (mesma policy de select).
alter publication supabase_realtime add table public.messages;
