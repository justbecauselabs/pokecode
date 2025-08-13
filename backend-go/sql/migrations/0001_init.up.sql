-- Create enums
DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE message_type AS ENUM ('user', 'assistant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sessions table
CREATE TABLE IF NOT EXISTS claude_code_sessions (
    id UUID PRIMARY KEY,
    project_path TEXT NOT NULL,
    context TEXT,
    status session_status NOT NULL DEFAULT 'active',
    claude_directory_path TEXT,
    claude_code_session_id TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_working BOOLEAN NOT NULL DEFAULT FALSE,
    current_job_id TEXT,
    last_job_status TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON claude_code_sessions (status);
CREATE INDEX IF NOT EXISTS idx_sessions_last_accessed ON claude_code_sessions (last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_working ON claude_code_sessions (is_working);

-- Session messages
CREATE TABLE IF NOT EXISTS session_messages (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES claude_code_sessions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    type message_type NOT NULL,
    claude_session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_messages_session_id ON session_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_session_messages_type ON session_messages (type);
CREATE INDEX IF NOT EXISTS idx_session_messages_created_at ON session_messages (created_at);
CREATE INDEX IF NOT EXISTS idx_session_messages_claude_session_id ON session_messages (claude_session_id);

