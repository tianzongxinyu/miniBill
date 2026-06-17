package service

import (
	"context"
	"log"
	"time"

	"github.com/minibill/minibill/internal/systemdb"
	"github.com/minibill/minibill/internal/userdb"
)

type BackupScheduler struct {
	backup   *BackupService
	system   *systemdb.Store
	factory  *userdb.Factory
	interval time.Duration
}

func NewBackupScheduler(backup *BackupService, system *systemdb.Store, factory *userdb.Factory) *BackupScheduler {
	return &BackupScheduler{
		backup:   backup,
		system:   system,
		factory:  factory,
		interval: time.Minute,
	}
}

func (sch *BackupScheduler) Run(ctx context.Context) {
	if !sch.backup.DirConfigured() {
		log.Printf("backup scheduler: disabled (BACKUP_DIR not configured)")
		return
	}
	log.Printf("backup scheduler: started (interval=%s)", sch.interval)
	sch.tick()
	ticker := time.NewTicker(sch.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sch.tick()
		}
	}
}

func (sch *BackupScheduler) tick() {
	if err := sch.backup.CheckDirWritable(); err != nil {
		log.Printf("backup scheduler: backup dir not writable: %v", err)
		return
	}
	users, err := sch.system.ListUsers()
	if err != nil {
		log.Printf("backup scheduler: list users: %v", err)
		return
	}
	for _, u := range users {
		sch.runUser(u)
	}
}

func (sch *BackupScheduler) runUser(u *systemdb.User) {
	path, err := sch.factory.LedgerPath(u.ID, u.DataPath)
	if err != nil {
		log.Printf("backup scheduler: ledger path user=%d: %v", u.ID, err)
		return
	}
	db, err := sch.factory.Open(u.ID, u.DataPath)
	if err != nil {
		log.Printf("backup scheduler: open ledger user=%d: %v", u.ID, err)
		return
	}
	cfg, err := sch.backup.GetConfig(db)
	if err != nil {
		log.Printf("backup scheduler: config user=%d: %v", u.ID, err)
		return
	}
	if !sch.backup.IsDue(*cfg, cfg.LastRunAt) {
		return
	}
	filename, err := sch.backup.RunBackup(db, u.ID, u.Username)
	if err != nil {
		log.Printf("backup scheduler: backup user=%s path=%s: %v", u.Username, path, err)
		return
	}
	log.Printf("backup scheduler: backup ok user=%s file=%s", u.Username, filename)
}
