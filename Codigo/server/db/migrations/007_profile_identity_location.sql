-- Identidade esportiva do perfil: nascimento, nacionalidade, medidas e foto
ALTER TABLE profiles
  ADD COLUMN birth_date DATE
    CHECK (birth_date IS NULL OR (birth_date >= DATE '1900-01-01' AND birth_date <= CURRENT_DATE)),
  ADD COLUMN nationality CHAR(2)
    CHECK (nationality IS NULL OR nationality ~ '^[A-Z]{2}$'),          -- código ISO do país (BR, PT, AR…)
  ADD COLUMN height_cm SMALLINT
    CHECK (height_cm IS NULL OR height_cm BETWEEN 100 AND 250),
  ADD COLUMN weight_kg NUMERIC(5,1)
    CHECK (weight_kg IS NULL OR weight_kg BETWEEN 30 AND 300),
  -- Foto recortada (PNG) guardada no próprio banco, sem depender do armazenamento S3
  ADD COLUMN photo_png BYTEA
    CHECK (photo_png IS NULL OR octet_length(photo_png) <= 2097152),
  ADD COLUMN photo_updated_at TIMESTAMPTZ;

-- Aceite obrigatório da política no cadastro (registro da versão aceita)
ALTER TABLE users
  ADD COLUMN policy_version TEXT,
  ADD COLUMN policy_accepted_at TIMESTAMPTZ;

-- Nova finalidade de consentimento: localização aproximada no mapa
ALTER TABLE consents DROP CONSTRAINT consents_purpose_check;
ALTER TABLE consents ADD CONSTRAINT consents_purpose_check
  CHECK (purpose IN ('performance','health','communications','location'));

-- Localização aproximada (2 casas decimais, ~1 km) de quem consentiu
CREATE TABLE user_locations (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat NUMERIC(4,2) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon NUMERIC(5,2) NOT NULL CHECK (lon BETWEEN -180 AND 180),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
