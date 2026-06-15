package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/minibill/minibill/internal/bootstrap"
	"github.com/minibill/minibill/internal/config"
	"github.com/minibill/minibill/internal/domain"
	"github.com/minibill/minibill/internal/service"

	_ "modernc.org/sqlite"
)

type monthKey = domain.YearMonth

func main() {
	username := flag.String("username", "yixin", "target username")
	years := flag.Int("years", 5, "years of history to generate")
	reset := flag.Bool("reset", false, "clear existing transactions and balances first")
	flag.Parse()

	cfg := config.Load()
	sys, err := bootstrap.OpenSystem(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer sys.Close()

	user, err := sys.Store.GetByUsername(*username)
	if err != nil {
		log.Fatal(err)
	}
	if user == nil {
		log.Fatalf("user %q not found", *username)
	}

	db, err := sys.Factory.Open(user.ID, user.DataPath)
	if err != nil {
		log.Fatal(err)
	}
	defer sys.Factory.CloseUser(user.ID)

	if *reset {
		if err := clearLedgerData(db); err != nil {
			log.Fatal(err)
		}
		fmt.Println("cleared existing ledger data")
	}

	end := time.Now()
	start := end.AddDate(-*years, 0, 0)
	startYM := domain.YearMonth{Year: start.Year(), Month: int(start.Month())}
	endYM := domain.YearMonth{Year: end.Year(), Month: int(end.Month())}

	tagIDs, err := loadTagIDs(db)
	if err != nil {
		log.Fatal(err)
	}
	contactIDs, err := ensureContacts(db)
	if err != nil {
		log.Fatal(err)
	}

	rng := rand.New(rand.NewSource(42))
	stats := service.NewStatsService()

	prev := domain.PrevMonth(startYM)
	prevBalance := int64(5000000)
	if _, err := db.Exec(
		`INSERT INTO monthly_balances (year, month, balance, note) VALUES (?, ?, ?, ?)
		 ON CONFLICT(year, month) DO UPDATE SET balance=excluded.balance, note=excluded.note`,
		prev.Year, prev.Month, prevBalance, "seed 期初",
	); err != nil {
		log.Fatal(err)
	}

	txCount := 0
	balanceCount := 0
	for ym := startYM; !after(ym, endYM); ym = domain.NextMonth(ym) {
		income, expenseTotal := genMonthTxs(db, rng, ym, tagIDs, contactIDs, end)
		txCount += income.count + expenseTotal.count

		isCurrent := ym.Year == endYM.Year && ym.Month == endYM.Month
		if !isCurrent {
			daily := int64(150000 + rng.Intn(250000))
			endBal := prevBalance + income.total + expenseTotal.total - daily
			if endBal < 0 {
				endBal = prevBalance / 2
			}
			if _, err := db.Exec(
				`INSERT INTO monthly_balances (year, month, balance) VALUES (?, ?, ?)
				 ON CONFLICT(year, month) DO UPDATE SET balance=excluded.balance`,
				ym.Year, ym.Month, endBal,
			); err != nil {
				log.Fatal(err)
			}
			prevBalance = endBal
			balanceCount++
		}

		if err := stats.RecalcStatMonth(db, ym.Year, ym.Month); err != nil {
			log.Fatal(err)
		}
	}

	fmt.Printf("seeded user %q: %d months, %d transactions, %d monthly balances (%04d-%02d .. %04d-%02d)\n",
		user.Username, monthsBetween(startYM, endYM)+1, txCount, balanceCount,
		startYM.Year, startYM.Month, endYM.Year, endYM.Month)
}

func clearLedgerData(db *sql.DB) error {
	stmts := []string{
		`DELETE FROM transaction_tags`,
		`DELETE FROM transactions`,
		`DELETE FROM monthly_balances`,
		`DELETE FROM stat_monthly`,
		`DELETE FROM contacts`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	return nil
}

func loadTagIDs(db *sql.DB) (map[string]int64, error) {
	rows, err := db.Query(`SELECT id, name FROM tags`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := make(map[string]int64)
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		m[name] = id
	}
	return m, rows.Err()
}

func ensureContacts(db *sql.DB) ([]int64, error) {
	names := []string{"张三", "李四", "王芳", "赵明", "陈静"}
	var ids []int64
	for _, name := range names {
		res, err := db.Exec(`INSERT INTO contacts (name) VALUES (?)`, name)
		if err != nil {
			return nil, err
		}
		id, _ := res.LastInsertId()
		ids = append(ids, id)
	}
	return ids, nil
}

type txSum struct {
	total int64
	count int
}

func genMonthTxs(
	db *sql.DB,
	rng *rand.Rand,
	ym domain.YearMonth,
	tagIDs map[string]int64,
	contactIDs []int64,
	now time.Time,
) (income txSum, expense txSum) {
	salary := int64(800000 + rng.Intn(400000))
	income.total = salary
	income.count = 1
	insertTx(db, salary, "income", fmt.Sprintf("%04d-%02d-05", ym.Year, ym.Month), "工资", []string{"工资"}, tagIDs, nil)

	if ym.Month%3 == 0 {
		bonus := int64(100000 + rng.Intn(300000))
		income.total += bonus
		income.count++
		insertTx(db, bonus, "income", fmt.Sprintf("%04d-%02d-15", ym.Year, ym.Month), "绩效奖金", []string{"奖金"}, tagIDs, nil)
	}

	categories := []struct {
		tag  string
		note string
		min  int64
		max  int64
	}{
		{"餐饮", "日常餐饮", 3000, 15000},
		{"交通", "通勤出行", 2000, 8000},
		{"居住", "水电物业", 10000, 35000},
		{"购物", "生活用品", 5000, 30000},
		{"订阅", "会员订阅", 1500, 8000},
		{"医疗", "医疗健康", 0, 20000},
		{"教育", "学习充电", 0, 25000},
	}

	n := 6 + rng.Intn(6)
	for i := 0; i < n; i++ {
		c := categories[rng.Intn(len(categories))]
		if c.max == 0 {
			continue
		}
		amt := c.min + int64(rng.Intn(int(c.max-c.min+1)))
		day := 1 + rng.Intn(28)
		date := fmt.Sprintf("%04d-%02d-%02d", ym.Year, ym.Month, day)
		if t, err := time.Parse("2006-01-02", date); err == nil && t.After(now) {
			date = now.Format("2006-01-02")
		}
		expense.total += amt
		expense.count++
		insertTx(db, amt, "expense", date, c.note, []string{c.tag}, tagIDs, nil)
	}

	if ym.Month%4 == 0 {
		amt := int64(20000 + rng.Intn(80000))
		cid := contactIDs[rng.Intn(len(contactIDs))]
		date := fmt.Sprintf("%04d-%02d-%02d", ym.Year, ym.Month, 10+rng.Intn(15))
		expense.total += amt
		expense.count++
		insertTx(db, amt, "expense", date, "礼金", []string{"人情", "婚礼"}, tagIDs, &cid)
	}
	return income, expense
}

func insertTx(
	db *sql.DB,
	amount int64,
	txType, date, note string,
	tags []string,
	tagIDs map[string]int64,
	contactID *int64,
) {
	var cid interface{}
	if contactID != nil {
		cid = *contactID
	}
	res, err := db.Exec(
		`INSERT INTO transactions (amount, type, transaction_date, note, contact_id) VALUES (?, ?, ?, ?, ?)`,
		amount, txType, date, note, cid,
	)
	if err != nil {
		log.Fatal(err)
	}
	id, _ := res.LastInsertId()
	for _, t := range tags {
		tid, ok := tagIDs[t]
		if !ok {
			continue
		}
		if _, err := db.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)`, id, tid); err != nil {
			log.Fatal(err)
		}
	}
}

func after(a, b domain.YearMonth) bool {
	return a.Year > b.Year || (a.Year == b.Year && a.Month > b.Month)
}

func monthsBetween(a, b domain.YearMonth) int {
	n := 0
	for cur := a; !after(cur, b); cur = domain.NextMonth(cur) {
		n++
	}
	return n - 1
}
