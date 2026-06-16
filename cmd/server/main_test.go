package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStaticFileToServe(t *testing.T) {
	root := t.TempDir()
	absRoot, err := filepath.Abs(root)
	if err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(filepath.Join(absRoot, "app.js"), []byte("ok"), 0o644); err != nil {
		t.Fatal(err)
	}
	loginDir := filepath.Join(absRoot, "login")
	if err := os.MkdirAll(loginDir, 0o755); err != nil {
		t.Fatal(err)
	}
	loginIndex := filepath.Join(loginDir, "index.html")
	if err := os.WriteFile(loginIndex, []byte("<html>login</html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	emptyDir := filepath.Join(absRoot, "empty")
	if err := os.MkdirAll(emptyDir, 0o755); err != nil {
		t.Fatal(err)
	}

	file, ok := staticFileToServe(absRoot, "/app.js")
	if !ok || file != filepath.Join(absRoot, "app.js") {
		t.Fatalf("expected app.js, got %q ok=%v", file, ok)
	}

	file, ok = staticFileToServe(absRoot, "/login/")
	if !ok || file != loginIndex {
		t.Fatalf("expected login index, got %q ok=%v", file, ok)
	}

	file, ok = staticFileToServe(absRoot, "/login")
	if !ok || file != loginIndex {
		t.Fatalf("expected login index for /login, got %q ok=%v", file, ok)
	}

	_, ok = staticFileToServe(absRoot, "/empty/")
	if ok {
		t.Fatal("directory without index.html should not resolve")
	}
}

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
