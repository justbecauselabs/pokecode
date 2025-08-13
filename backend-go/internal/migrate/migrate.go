package migrate

import (
    "context"
    "crypto/sha1"
    "encoding/hex"
    "io/fs"
    "os"
    "path/filepath"
    "sort"
    "strings"
    "time"

    "backend-go/internal/db"
)

// Simple file-based migration runner applying all *.up.sql under dir in name order.
func Up(ctx context.Context, d *db.DB, dir string) error {
    // ensure schema_migrations table
    _, err := d.Pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    if err != nil {
        return err
    }

    // load applied versions
    applied := map[string]string{}
    rows, err := d.Pool.Query(ctx, `SELECT version, checksum FROM schema_migrations`)
    if err != nil {
        return err
    }
    for rows.Next() {
        var v, c string
        _ = rows.Scan(&v, &c)
        applied[v] = c
    }
    rows.Close()

    // read files
    var files []string
    _ = filepath.WalkDir(dir, func(path string, de fs.DirEntry, err error) error {
        if err != nil || de.IsDir() {
            return nil
        }
        if strings.HasSuffix(de.Name(), ".up.sql") {
            files = append(files, path)
        }
        return nil
    })
    sort.Strings(files)

    for _, f := range files {
        b, err := os.ReadFile(f)
        if err != nil {
            return err
        }
        version := filepath.Base(f)
        sum := sha1.Sum(b)
        hexsum := hex.EncodeToString(sum[:])
        if old, ok := applied[version]; ok {
            if old == hexsum {
                continue // already applied
            }
            // checksum changed: re-apply by transaction (naive approach)
        }
        // execute as single batch
        tx, err := d.Pool.Begin(ctx)
        if err != nil { return err }
        if _, err := tx.Exec(ctx, string(b)); err != nil {
            _ = tx.Rollback(ctx)
            return err
        }
        if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations(version, checksum, applied_at) VALUES($1,$2,$3)
            ON CONFLICT(version) DO UPDATE SET checksum=EXCLUDED.checksum, applied_at=EXCLUDED.applied_at`, version, hexsum, time.Now()); err != nil {
            _ = tx.Rollback(ctx)
            return err
        }
        if err := tx.Commit(ctx); err != nil { return err }
    }
    return nil
}

