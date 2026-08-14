package service

import (
	"context"
	"log"
	"time"

	"github.com/minibill/minibill/internal/systemdb"
	"github.com/minibill/minibill/internal/userdb"
)

const backupScanInterval = 5 * time.Minute

type BackupScheduler struct {
	backup  *BackupService
	system  *systemdb.Store
	factory *userdb.Factory
	now     func() time.Time
}

func NewBackupScheduler(backup *BackupService, system *systemdb.Store, factory *userdb.Factory) *BackupScheduler {
	return &BackupScheduler{
		backup:  backup,
		system:  system,
		factory: factory,
		now:     time.Now,
	}
}

// nextBackupScanAt returns the next wall-clock slot aligned to midnight + N*5min,
// strictly after now when now falls exactly on a slot (startup tick already covered it).
func nextBackupScanAt(now time.Time) time.Time {
	loc := now.Location()
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	elapsed := now.Sub(midnight)
	steps := elapsed / backupScanInterval
	next := midnight.Add((steps + 1) * backupScanInterval)
	return next
}

func (sch *BackupScheduler) Run(ctx context.Context) {
	if !sch.backup.DirConfigured() {
		log.Printf("backup scheduler: disabled (BACKUP_DIR not configured)")
		return
	}
	log.Printf("backup scheduler: started (on start + every %s from midnight local)", backupScanInterval)
	sch.tick()

	for {
		now := sch.now()
		next := nextBackupScanAt(now)
		wait := next.Sub(now)
		if wait < 0 {
			wait = 0
		}
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			return
		case <-timer.C:
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
