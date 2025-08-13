package http

import (
    "fmt"
    "encoding/json"
    "net/http"
    "path/filepath"

    "backend-go/internal/config"
    "backend-go/internal/db"
    "backend-go/internal/repo"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
)

type createSessionBody struct {
    ProjectPath *string         `json:"projectPath"`
    FolderName  *string         `json:"folderName"`
    Context     *string         `json:"context"`
    Metadata    map[string]any  `json:"metadata"`
}

type updateSessionBody struct {
    Context *string        `json:"context"`
    Status  *string        `json:"status"`
    Metadata map[string]any `json:"metadata"`
}

func RegisterSessionRoutes(r *gin.Engine, cfg *config.Config, dbh *db.DB) {
    group := r.Group("/api/claude-code/sessions")

    group.POST("/", func(c *gin.Context) {
        var body createSessionBody
        if err := c.ShouldBindJSON(&body); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }
        if (body.ProjectPath == nil || *body.ProjectPath == "") && (body.FolderName == nil || *body.FolderName == "") {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Either projectPath or folderName must be provided"})
            return
        }
        if body.ProjectPath != nil && body.FolderName != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot provide both projectPath and folderName"})
            return
        }
        projectPath := ""
        if body.FolderName != nil {
            // resolve against repos dir
            projectPath = filepath.Join(cfg.ReposDir, *body.FolderName)
        } else if body.ProjectPath != nil {
            projectPath = *body.ProjectPath
        }
        metaBytes, _ := json.Marshal(body.Metadata)
        s, err := repo.CreateSession(c.Request.Context(), dbh, repo.CreateSessionInput{ProjectPath: projectPath, Context: body.Context, Metadata: metaBytes})
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }
        c.JSON(http.StatusCreated, toSessionResponse(s))
    })

    group.GET("/", func(c *gin.Context) {
        // optional status, limit, offset
        status := c.Query("status")
        var stp *string
        if status != "" { stp = &status }
        limit := parseIntDefault(c.Query("limit"), 20)
        offset := parseIntDefault(c.Query("offset"), 0)
        sessions, total, err := repo.ListSessions(c.Request.Context(), dbh, repo.ListOptions{Status: stp, Limit: int32(limit), Offset: int32(offset)})
        if err != nil { c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return }
        out := make([]gin.H, 0, len(sessions))
        for i := range sessions { out = append(out, toSessionResponse(&sessions[i])) }
        c.JSON(http.StatusOK, gin.H{"sessions": out, "total": total, "limit": limit, "offset": offset})
    })

    group.GET("/:sessionId", func(c *gin.Context) {
        idStr := c.Param("sessionId")
        id, err := uuid.Parse(idStr)
        if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid uuid"}); return }
        s, err := repo.GetSession(c.Request.Context(), dbh, id)
        if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"}); return }
        c.JSON(http.StatusOK, toSessionResponse(s))
    })

    group.PATCH("/:sessionId", func(c *gin.Context) {
        id, err := uuid.Parse(c.Param("sessionId"))
        if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid uuid"}); return }
        var body updateSessionBody
        if err := c.ShouldBindJSON(&body); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return }
        metaBytes, _ := json.Marshal(body.Metadata)
        s, err := repo.UpdateSession(c.Request.Context(), dbh, id, repo.UpdateSessionInput{Context: body.Context, Status: body.Status, Metadata: metaBytes})
        if err != nil { c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"}); return }
        c.JSON(http.StatusOK, toSessionResponse(s))
    })

    group.DELETE("/:sessionId", func(c *gin.Context) {
        id, err := uuid.Parse(c.Param("sessionId"))
        if err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": "invalid uuid"}); return }
        if err := repo.DeleteSession(c.Request.Context(), dbh, id); err != nil { c.JSON(http.StatusNotFound, gin.H{"error": "Session not found"}); return }
        c.JSON(http.StatusOK, gin.H{"success": true})
    })
}

func toSessionResponse(s *repo.Session) gin.H {
    return gin.H{
        "id": s.ID.String(),
        "projectPath": s.ProjectPath,
        "claudeDirectoryPath": s.ClaudeDirectoryPath,
        "claudeCodeSessionId": s.ClaudeCodeSessionID,
        "context": s.Context,
        "status": s.Status,
        "metadata": jsonRawOrNil(s.Metadata),
        "createdAt": s.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
        "updatedAt": s.UpdatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
        "lastAccessedAt": s.LastAccessedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
        "isWorking": s.IsWorking,
        "currentJobId": s.CurrentJobID,
        "lastJobStatus": s.LastJobStatus,
    }
}

func jsonRawOrNil(b []byte) any {
    if len(b) == 0 || string(b) == "null" { return nil }
    var v any
    if err := json.Unmarshal(b, &v); err != nil { return nil }
    return v
}

func parseIntDefault(s string, def int) int {
    if s == "" { return def }
    var n int
    if _, err := fmt.Sscanf(s, "%d", &n); err != nil { return def }
    return n
}
