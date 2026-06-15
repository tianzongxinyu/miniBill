package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/auth"
	"github.com/minibill/minibill/internal/bootstrap"
	"github.com/minibill/minibill/internal/config"
	"github.com/minibill/minibill/internal/handler"

	_ "modernc.org/sqlite"
)

func main() {
	cfg := config.Load()
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	sys, err := bootstrap.OpenSystem(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer sys.Close()

	authSvc := auth.NewService(cfg.JWTSecret, cfg.JWTExpireDuration())
	srv := handler.NewServer(cfg, sys.Store, sys.Factory, authSvc)
	r := srv.Router()

	if stat, err := os.Stat(cfg.StaticDir); err == nil && stat.IsDir() {
		r.NoRoute(func(c *gin.Context) {
			if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
				c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND"})
				return
			}
			path := filepath.Join(cfg.StaticDir, c.Request.URL.Path)
			if info, err := os.Stat(path); err == nil && !info.IsDir() {
				c.File(path)
				return
			}
			c.File(filepath.Join(cfg.StaticDir, "index.html"))
		})
	}

	log.Printf("%s listening on :%s", "轻账单", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
