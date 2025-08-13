package http

import (
    "net/http"

    "backend-go/internal/config"
    "backend-go/internal/queue"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "github.com/rs/zerolog"
)

type createPromptBody struct {
    Prompt      string `json:"prompt" binding:"required,min=1"`
    ProjectPath string `json:"projectPath"`
}

func RegisterPromptRoutes(r *gin.Engine, cfg *config.Config, logger zerolog.Logger, q *queue.Client) {
    group := r.Group("/api/claude-code/sessions/:sessionId/prompts")

    group.POST("/", func(c *gin.Context) {
        sessionID := c.Param("sessionId")
        var body createPromptBody
        if err := c.ShouldBindJSON(&body); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }

        jobID := uuid.New().String()
        projectPath := body.ProjectPath
        if projectPath == "" {
            projectPath = cfg.ReposDir
        }

        if err := q.EnqueuePrompt(c.Request.Context(), queue.PromptTask{
            SessionID:   sessionID,
            PromptID:    jobID,
            Prompt:      body.Prompt,
            ProjectPath: projectPath,
            MessageID:   uuid.New().String(),
        }); err != nil {
            logger.Error().Err(err).Msg("enqueue prompt failed")
            c.JSON(http.StatusInternalServerError, gin.H{"error": "enqueue failed"})
            return
        }

        c.JSON(http.StatusCreated, gin.H{
            "success":   true,
            "message":   "Prompt queued successfully",
            "jobId":     jobID,
            "sessionId": sessionID,
        })
    })
}

