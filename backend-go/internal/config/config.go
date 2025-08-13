package config

import (
    "fmt"
    "time"
    "strings"

    env "github.com/caarlos0/env/v11"
)

type Config struct {
    Port        int    `env:"PORT" envDefault:"3001"`
    LogLevel    string `env:"LOG_LEVEL" envDefault:"info"`
    RedisURL    string `env:"REDIS_URL" envDefault:"redis://localhost:6379"`
    ClaudePath  string `env:"CLAUDE_CODE_PATH"`
    ReposDir    string `env:"GITHUB_REPOS_DIRECTORY" envDefault:"/tmp"`

    // Timeouts
    PromptTimeout time.Duration `env:"PROMPT_TIMEOUT" envDefault:"2m"`

    // Database
    DatabaseURL string `env:"DATABASE_URL"`
    DBHost      string `env:"DB_HOST" envDefault:"localhost"`
    DBPort      int    `env:"DB_PORT" envDefault:"5432"`
    DBName      string `env:"DB_NAME" envDefault:"postgres"`
    DBUser      string `env:"DB_USER" envDefault:"postgres"`
    DBPassword  string `env:"DB_PASSWORD" envDefault:""`
}

func Load() (*Config, error) {
    var c Config
    if err := env.Parse(&c); err != nil {
        return nil, err
    }
    return &c, nil
}

func (c *Config) Address() string { return fmt.Sprintf(":%d", c.Port) }

func (c *Config) DatabaseDSN() string {
    // postgres://user:pass@host:port/dbname
    pass := c.DBPassword
    if pass != "" {
        return fmt.Sprintf("postgres://%s:%s@%s:%d/%s", c.DBUser, urlQueryEscape(pass), c.DBHost, c.DBPort, c.DBName)
    }
    return fmt.Sprintf("postgres://%s@%s:%d/%s", c.DBUser, c.DBHost, c.DBPort, c.DBName)
}

func urlQueryEscape(s string) string {
    // basic escape for ':' and '@' in passwords
    r := ""
    for i := 0; i < len(s); i++ {
        ch := s[i]
        switch ch {
        case ':', '@', '/', '?', '#':
            r += fmt.Sprintf("%%%02X", ch)
        default:
            r += string(ch)
        }
    }
    return r
}

func (c *Config) SafeDatabaseDSN() string {
    if c.DatabaseURL != "" { return "(from DATABASE_URL)" }
    dsn := c.DatabaseDSN()
    // redact password between : and @ if present
    // postgres://user:pass@host:port/db
    if i := strings.Index(dsn, "://"); i >= 0 {
        rest := dsn[i+3:]
        if at := strings.Index(rest, "@"); at > 0 {
            userpass := rest[:at]
            if colon := strings.Index(userpass, ":"); colon > 0 {
                return dsn[:i+3] + userpass[:colon] + ":***" + rest[at:]
            }
        }
    }
    return dsn
}
