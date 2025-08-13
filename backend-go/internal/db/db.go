package db

import (
    "context"
    "fmt"
    "time"

    "backend-go/internal/config"
    "github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
    Pool *pgxpool.Pool
}

func Open(ctx context.Context, cfg *config.Config) (*DB, error) {
    dsn := cfg.DatabaseURL
    if dsn == "" {
        dsn = cfg.DatabaseDSN()
    }
    conf, err := pgxpool.ParseConfig(dsn)
    if err != nil {
        return nil, fmt.Errorf("parse db config: %w", err)
    }
    // Reasonable defaults
    conf.MaxConns = 10
    conf.MinConns = 0
    conf.MaxConnLifetime = time.Hour
    conf.MaxConnIdleTime = 15 * time.Minute

    pool, err := pgxpool.NewWithConfig(ctx, conf)
    if err != nil {
        return nil, fmt.Errorf("open db: %w", err)
    }
    return &DB{Pool: pool}, nil
}

func (d *DB) Close() { d.Pool.Close() }

func (d *DB) Ping(ctx context.Context) error {
    c, err := d.Pool.Acquire(ctx)
    if err != nil {
        return err
    }
    defer c.Release()
    var one int
    if err := c.QueryRow(ctx, "SELECT 1").Scan(&one); err != nil {
        return err
    }
    if one != 1 {
        return fmt.Errorf("db ping returned %d", one)
    }
    return nil
}

