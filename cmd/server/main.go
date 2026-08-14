package main

import (
	"context"
	"log"
	"net"
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
	"github.com/minibill/minibill/internal/middleware"
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
	recurringSch := service.NewRecurringScheduler(srv.RecurringService(), sys.Store, sys.Factory)
	go recurringSch.Run(ctx)

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
				setStaticCacheControl(c, file)
				c.File(file)
				return
			}
			setStaticCacheControl(c, indexHTML)
			c.File(indexHTML)
		})
	}

	var handlerHTTP http.Handler = r
	if cfg.GatewayPrefix != "" {
		handlerHTTP = middleware.StripPrefixHandler(cfg.GatewayPrefix, r)
	}

	httpSrv := &http.Server{
		Handler:     handlerHTTP,
		ConnContext: middleware.GatewayConnContext,
	}

	go func() {
		log.Printf("%s %s listening on :%s", "轻账单", version, cfg.Port)
		ln, err := net.Listen("tcp", ":"+cfg.Port)
		if err != nil {
			log.Fatal(err)
		}
		if err := httpSrv.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	if sock := cfg.GatewaySocket; sock != "" {
		go func() {
			_ = os.Remove(sock)
			if err := os.MkdirAll(filepath.Dir(sock), 0o755); err != nil {
				log.Printf("gateway socket dir: %v", err)
				return
			}
			ln, err := net.Listen("unix", sock)
			if err != nil {
				log.Printf("gateway unix listen %s: %v", sock, err)
				return
			}
			if err := os.Chmod(sock, 0o666); err != nil {
				log.Printf("gateway socket chmod: %v", err)
			}
			log.Printf("%s %s listening on unix %s (prefix=%s)", "轻账单", version, sock, cfg.GatewayPrefix)
			if err := httpSrv.Serve(ln); err != nil && err != http.ErrServerClosed {
				log.Printf("gateway serve: %v", err)
			}
		}()
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	cancel()
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	_ = httpSrv.Shutdown(shutdownCtx)
	if sock := cfg.GatewaySocket; sock != "" {
		_ = os.Remove(sock)
	}
}

func setStaticCacheControl(c *gin.Context, filePath string) {
	c.Header("Cache-Control", staticCacheControl(filePath))
}

// staticCacheControl returns Cache-Control for a static file path.
// Hashed Next.js assets under _next/static may be cached long-term;
// HTML and other unhashed assets must revalidate so upgrades show new UI.
func staticCacheControl(filePath string) string {
	slash := filepath.ToSlash(filePath)
	if strings.Contains(slash, "/_next/static/") {
		return "public, max-age=31536000, immutable"
	}
	return "no-cache"
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
