package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/minibill/minibill/internal/bootstrap"
	"github.com/minibill/minibill/internal/config"
)

func main() {
	username := flag.String("username", "", "username")
	password := flag.String("password", "", "new password")
	flag.Parse()
	if *username == "" || *password == "" {
		fmt.Fprintln(os.Stderr, "usage: reset-password -username alice -password newsecret")
		os.Exit(1)
	}

	cfg := config.Load()
	cfg.ResolvePaths()
	if err := cfg.Validate(); err != nil {
		log.Fatal(err)
	}

	fmt.Fprintf(os.Stderr, "using DATA_DIR=%s\n", cfg.DataDir)

	dbPath := filepath.Join(cfg.DataDir, "system.db")
	if _, err := os.Stat(dbPath); err != nil {
		log.Fatalf("system.db 不存在: %s（请确认 DATA_DIR 指向实际数据目录，勿指向空目录）", dbPath)
	}

	sys, err := bootstrap.OpenSystem(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer sys.Close()

	user, err := bootstrap.ResetUserPassword(sys, *username, *password)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("reset password for %s (id=%d)\n", user.Username, user.ID)
}
