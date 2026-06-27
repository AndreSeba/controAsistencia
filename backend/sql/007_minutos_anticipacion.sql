-- 007_minutos_anticipacion.sql
-- Agrega minutos_anticipacion a marcacion: igual que minutos_atraso pero para el otro
-- sentido (llegó antes de hora_inicio). Permite a RRHH ver POR QUÉ una marcación quedó
-- en requiere_revision (antes solo se calculaba y se perdía, sin persistir el motivo).

ALTER TABLE marcacion ADD COLUMN IF NOT EXISTS minutos_anticipacion INT NULL; -- solo en ENTRADA, floor(), >0
