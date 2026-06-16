package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSafeStaticFile(t *testing.T) {
	root := t.TempDir()
	absRoot, err := filepath.Abs(root)
	if err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(absRoot, "app.js")
	if err := os.WriteFile(file, []byte("ok"), 0o644); err != nil {
		t.Fatal(err)
	}

	okPath, ok := safeStaticFile(absRoot, "/app.js")
	if !ok || okPath != file {
		t.Fatalf("expected file %q, got %q ok=%v", file, okPath, ok)
	}

	traversalPath, ok := safeStaticFile(absRoot, "/../../../etc/passwd")
	if ok && !strings.HasPrefix(traversalPath, absRoot+string(os.PathSeparator)) {
		t.Fatalf("path escaped static root: %q", traversalPath)
	}
	if ok && traversalPath == filepath.Clean("/etc/passwd") {
		t.Fatal("must not resolve to system /etc/passwd")
	}
}
