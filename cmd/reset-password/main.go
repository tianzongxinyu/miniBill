package main

import (
	"flag"
	"fmt"
	"log"
	"os"

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
	if err := cfg.Validate(); err != nil {
		log.Fatal(err)
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
