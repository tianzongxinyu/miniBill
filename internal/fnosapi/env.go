package fnosapi

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func shellQuote(v string) string {
	return "'" + strings.ReplaceAll(v, "'", `'\''`) + "'"
}

// EnvFilePath returns pkgvar/minibill.env next to DATA_DIR (.../minibill/data → .../minibill/minibill.env).
func EnvFilePath(dataDir string) string {
	dataDir = strings.TrimSpace(dataDir)
	if dataDir == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(dataDir), "minibill.env")
}

// PatchBackupDirEnv updates BACKUP_DIR in minibill.env when the file exists.
// Missing file is a no-op (non-fnOS / Docker without that layout).
func PatchBackupDirEnv(dataDir, backupDir string) error {
	envFile := EnvFilePath(dataDir)
	if envFile == "" {
		return nil
	}
	info, err := os.Stat(envFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("env path is a directory: %s", envFile)
	}

	f, err := os.Open(envFile)
	if err != nil {
		return err
	}

	var lines []string
	found := false
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "BACKUP_DIR=") {
			found = true
			if backupDir == "" {
				lines = append(lines, "BACKUP_DIR=")
			} else {
				lines = append(lines, "BACKUP_DIR="+shellQuote(backupDir))
			}
			continue
		}
		lines = append(lines, line)
	}
	scanErr := sc.Err()
	_ = f.Close()
	if scanErr != nil {
		return scanErr
	}
	if !found {
		if backupDir == "" {
			lines = append(lines, "BACKUP_DIR=")
		} else {
			lines = append(lines, "BACKUP_DIR="+shellQuote(backupDir))
		}
	}

	tmp := envFile + ".tmp"
	out := strings.Join(lines, "\n") + "\n"
	if err := os.WriteFile(tmp, []byte(out), 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmp, envFile); err != nil {
		// Windows cannot rename over an existing file.
		_ = os.Remove(envFile)
		if err2 := os.Rename(tmp, envFile); err2 != nil {
			_ = os.Remove(tmp)
			return err2
		}
	}
	return nil
}
