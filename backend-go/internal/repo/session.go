package repo

import (
    "context"
    "errors"
    "time"

    "backend-go/internal/claude"
    "backend-go/internal/db"
    "github.com/google/uuid"
)

type Session struct {
    ID                 uuid.UUID
    ProjectPath        string
    Context            *string
    Status             string
    ClaudeDirectoryPath *string
    ClaudeCodeSessionID *string
    Metadata           []byte // raw JSON
    CreatedAt          time.Time
    UpdatedAt          time.Time
    LastAccessedAt     time.Time
    IsWorking          bool
    CurrentJobID       *string
    LastJobStatus      *string
}

type CreateSessionInput struct {
    ProjectPath string
    Context     *string
    Metadata    []byte // JSON
}

func CreateSession(ctx context.Context, d *db.DB, in CreateSessionInput) (*Session, error) {
    id := uuid.New()
    dir := claude.ClaudeDirectoryPath(in.ProjectPath, id.String())
    row := d.Pool.QueryRow(ctx, `INSERT INTO claude_code_sessions (id, project_path, context, status, claude_directory_path, metadata)
        VALUES ($1,$2,$3,'active',$4,$5)
        RETURNING id, project_path, context, status, claude_directory_path, claude_code_session_id, metadata, created_at, updated_at, last_accessed_at, is_working, current_job_id, last_job_status`,
        id, in.ProjectPath, in.Context, dir, in.Metadata)
    var s Session
    if err := row.Scan(&s.ID, &s.ProjectPath, &s.Context, &s.Status, &s.ClaudeDirectoryPath, &s.ClaudeCodeSessionID, &s.Metadata, &s.CreatedAt, &s.UpdatedAt, &s.LastAccessedAt, &s.IsWorking, &s.CurrentJobID, &s.LastJobStatus); err != nil {
        return nil, err
    }
    return &s, nil
}

func GetSession(ctx context.Context, d *db.DB, id uuid.UUID) (*Session, error) {
    row := d.Pool.QueryRow(ctx, `SELECT id, project_path, context, status, claude_directory_path, claude_code_session_id, metadata, created_at, updated_at, last_accessed_at, is_working, current_job_id, last_job_status
        FROM claude_code_sessions WHERE id=$1`, id)
    var s Session
    if err := row.Scan(&s.ID, &s.ProjectPath, &s.Context, &s.Status, &s.ClaudeDirectoryPath, &s.ClaudeCodeSessionID, &s.Metadata, &s.CreatedAt, &s.UpdatedAt, &s.LastAccessedAt, &s.IsWorking, &s.CurrentJobID, &s.LastJobStatus); err != nil {
        return nil, err
    }
    // update last accessed
    _, _ = d.Pool.Exec(ctx, `UPDATE claude_code_sessions SET last_accessed_at=NOW() WHERE id=$1`, id)
    return &s, nil
}

type ListOptions struct { Status *string; Limit, Offset int32 }

func ListSessions(ctx context.Context, d *db.DB, opt ListOptions) ([]Session, int64, error) {
    where := "WHERE claude_code_session_id IS NOT NULL"
    args := []any{}
    if opt.Status != nil {
        where += " AND status=$1"
        args = append(args, *opt.Status)
    }
    // count
    var count int64
    if err := d.Pool.QueryRow(ctx, `SELECT count(*) FROM claude_code_sessions `+where, args...).Scan(&count); err != nil { return nil, 0, err }
    // list
    if opt.Limit == 0 { opt.Limit = 20 }
    rows, err := d.Pool.Query(ctx, `SELECT id, project_path, context, status, claude_directory_path, claude_code_session_id, metadata, created_at, updated_at, last_accessed_at, is_working, current_job_id, last_job_status
        FROM claude_code_sessions `+where+` ORDER BY last_accessed_at DESC LIMIT $2 OFFSET $3`, append(args, opt.Limit, opt.Offset)...)
    if err != nil { return nil, 0, err }
    defer rows.Close()
    var out []Session
    for rows.Next() {
        var s Session
        if err := rows.Scan(&s.ID, &s.ProjectPath, &s.Context, &s.Status, &s.ClaudeDirectoryPath, &s.ClaudeCodeSessionID, &s.Metadata, &s.CreatedAt, &s.UpdatedAt, &s.LastAccessedAt, &s.IsWorking, &s.CurrentJobID, &s.LastJobStatus); err != nil { return nil, 0, err }
        out = append(out, s)
    }
    return out, count, nil
}

type UpdateSessionInput struct { Context *string; Status *string; Metadata []byte }

func UpdateSession(ctx context.Context, d *db.DB, id uuid.UUID, in UpdateSessionInput) (*Session, error) {
    // fetch current to merge metadata
    cur, err := GetSession(ctx, d, id)
    if err != nil { return nil, err }
    // naive updates
    _, err = d.Pool.Exec(ctx, `UPDATE claude_code_sessions SET context=COALESCE($2,context), status=COALESCE($3,status), metadata=COALESCE($4,metadata), updated_at=NOW() WHERE id=$1`, id, in.Context, in.Status, coalesceJSON(in.Metadata, cur.Metadata))
    if err != nil { return nil, err }
    return GetSession(ctx, d, id)
}

func DeleteSession(ctx context.Context, d *db.DB, id uuid.UUID) error {
    ct, err := d.Pool.Exec(ctx, `DELETE FROM claude_code_sessions WHERE id=$1`, id)
    if err != nil { return err }
    if ct.RowsAffected() == 0 { return errors.New("not found") }
    return nil
}

func coalesceJSON(new []byte, old []byte) []byte {
    if len(new) > 0 { return new }
    return old
}

