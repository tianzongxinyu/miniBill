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
	password := flag.String("password", "", "password")
	flag.Parse()
	if *username == "" || *password == "" {
		fmt.Fprintln(os.Stderr, "usage: create-user -username alice -password secret")
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

	user, err := bootstrap.ProvisionUser(sys, *username, *password)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("created user %s (id=%d)\n", user.Username, user.ID)
}
