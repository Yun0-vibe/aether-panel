package main

import (
	"log"
	"os"
)

func main() {
	token := os.Getenv("AETHER_TOKEN")
	if token == "" {
		log.Fatal("AETHER_TOKEN is required (shared secret, must match the token stored on the panel)")
	}
	port := os.Getenv("AETHER_PORT")
	if port == "" {
		port = "8080"
	}

	if err := run(token, port); err != nil {
		log.Fatal(err)
	}
}



