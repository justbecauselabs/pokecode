package logz

import (
    "os"
    "strings"

    "github.com/rs/zerolog"
)

func New(level string) zerolog.Logger {
    zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
    l := zerolog.InfoLevel
    switch strings.ToLower(level) {
    case "trace":
        l = zerolog.TraceLevel
    case "debug":
        l = zerolog.DebugLevel
    case "warn":
        l = zerolog.WarnLevel
    case "error":
        l = zerolog.ErrorLevel
    case "fatal":
        l = zerolog.FatalLevel
    }
    logger := zerolog.New(os.Stdout).Level(l).With().Timestamp().Logger()
    return logger
}

