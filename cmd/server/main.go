package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/minibill/minibill/internal/auth"
	"github.com/minibill/minibill/internal/bootstrap"
	"github.com/minibill/minibill/internal/config"
	"github.com/minibill/minibill/internal/handler"
	"github.com/minibill/minibill/internal/service"

	_ "modernc.org/sqlite"
)

var version = "dev"

func main() {
	if v := strings.TrimSpace(os.Getenv("MINIBILL_VERSION")); v != "" {
		version = v
	}
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatal(err)
	}
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	sys, err := bootstrap.OpenSystem(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer sys.Close()

	authSvc := auth.NewService(sys.Cfg.JWTSecret, sys.Cfg.JWTExpireDuration())
	srv := handler.NewServerWithVersion(sys.Cfg, sys.Store, sys.Factory, authSvc, version)
	r := srv.Router()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	scheduler := service.NewBackupScheduler(srv.BackupService(), sys.Store, sys.Factory)
	go scheduler.Run(ctx)

	if stat, err := os.Stat(cfg.StaticDir); err == nil && stat.IsDir() {
		absStaticRoot, err := filepath.Abs(cfg.StaticDir)
		if err != nil {
			log.Fatal(err)
		}
		indexHTML := filepath.Join(absStaticRoot, "index.html")
		r.NoRoute(func(c *gin.Context) {
			if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
				c.JSON(http.StatusNotFound, gin.H{"error": "NOT_FOUND"})
				return
			}
			if file, ok := staticFileToServe(absStaticRoot, c.Request.URL.Path); ok {
				c.File(file)
				return
			}
			c.File(indexHTML)
		})
	}

	httpSrv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	go func() {
		log.Printf("%s %s listening on :%s", "轻账单", version, cfg.Port)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	cancel()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	_ = httpSrv.Shutdown(shutdownCtx)
}

func staticFileToServe(absRoot, urlPath string) (string, bool) {
	path, ok := safeStaticFile(absRoot, urlPath)
	if !ok {
		return "", false
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", false
	}
	if !info.IsDir() {
		return path, true
	}
	index := filepath.Join(path, "index.html")
	st, err := os.Stat(index)
	if err != nil || st.IsDir() {
		return "", false
	}
	return index, true
}

func safeStaticFile(absRoot, urlPath string) (string, bool) {
	rel := strings.TrimPrefix(filepath.Clean(urlPath), "/")
	if rel == "" || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", false
	}
	joined := filepath.Join(absRoot, rel)
	absPath, err := filepath.Abs(joined)
	if err != nil {
		return "", false
	}
	if absPath != absRoot && !strings.HasPrefix(absPath, absRoot+string(os.PathSeparator)) {
		return "", false
	}
	return absPath, true
}
