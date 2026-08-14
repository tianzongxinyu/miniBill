package service

import (
	"context"
	"log"
	"time"

	"github.com/minibill/minibill/internal/systemdb"
	"github.com/minibill/minibill/internal/userdb"
)

const (
	recurringRunHour   = 1
	recurringRunMinute = 0
)

type RecurringScheduler struct {
	recurring *RecurringService
	system    *systemdb.Store
	factory   *userdb.Factory
	now       func() time.Time
}

func NewRecurringScheduler(recurring *RecurringService, system *systemdb.Store, factory *userdb.Factory) *RecurringScheduler {
	return &RecurringScheduler{
		recurring: recurring,
		system:    system,
		factory:   factory,
		now:       time.Now,
	}
}

// nextRecurringRunAt returns the next local 01:00 strictly after now
// when now is exactly 01:00:00, still schedule the following day
// (startup tick already covered "now").
func nextRecurringRunAt(now time.Time) time.Time {
	loc := now.Location()
	today := time.Date(now.Year(), now.Month(), now.Day(), recurringRunHour, recurringRunMinute, 0, 0, loc)
	if now.Before(today) {
		return today
	}
	return today.AddDate(0, 0, 1)
}

func (sch *RecurringScheduler) Run(ctx context.Context) {
	log.Printf("recurring scheduler: started (on start + daily at %02d:%02d local)", recurringRunHour, recurringRunMinute)
	sch.tick()

	for {
		now := sch.now()
		next := nextRecurringRunAt(now)
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

func (sch *RecurringScheduler) tick() {
	users, err := sch.system.ListUsers()
	if err != nil {
		log.Printf("recurring scheduler: list users: %v", err)
		return
	}
	for _, u := range users {
		sch.runUser(u)
	}
}

func (sch *RecurringScheduler) runUser(u *systemdb.User) {
	db, err := sch.factory.Open(u.ID, u.DataPath)
	if err != nil {
		log.Printf("recurring scheduler: open ledger user=%d: %v", u.ID, err)
		return
	}
	n, err := sch.recurring.ProcessDue(db)
	if err != nil {
		log.Printf("recurring scheduler: process user=%s: %v", u.Username, err)
		return
	}
	if n > 0 {
		log.Printf("recurring scheduler: created %d tx user=%s", n, u.Username)
	}
}
