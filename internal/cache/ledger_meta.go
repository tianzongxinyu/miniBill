package cache

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"sync"

	gocache "github.com/patrickmn/go-cache"
	lru "github.com/hashicorp/golang-lru/v2"
)

const (
	prefixTagName     = "t:n:"
	prefixTagID       = "t:i:"
	prefixContactName = "c:n:"
	prefixContactID   = "c:i:"
	defaultUserSlots  = 256
)

// SQLExec 供 *sql.DB 与 *sql.Tx 共用的查询接口。
type SQLExec interface {
	Query(query string, args ...any) (*sql.Rows, error)
	QueryRow(query string, args ...any) *sql.Row
	Exec(query string, args ...any) (sql.Result, error)
}

// LedgerMetaStore 按用户 LRU 管理账本元数据缓存（标签、联系人）。
type LedgerMetaStore struct {
	lru *lru.Cache[int64, *LedgerMeta]
}

func NewLedgerMetaStore(capacity int) *LedgerMetaStore {
	if capacity <= 0 {
		capacity = defaultUserSlots
	}
	c, _ := lru.New[int64, *LedgerMeta](capacity)
	return &LedgerMetaStore{lru: c}
}

func (s *LedgerMetaStore) ForUser(userID int64) *LedgerMeta {
	if m, ok := s.lru.Get(userID); ok {
		return m
	}
	m := newLedgerMeta()
	s.lru.Add(userID, m)
	return m
}

func (s *LedgerMetaStore) Invalidate(userID int64) {
	s.lru.Remove(userID)
}

type txTagEntry struct {
	ID   int64
	Name string
}

// LedgerMeta 单用户标签/联系人缓存，基于 go-cache；先查缓存，未命中再查库并回填。
type LedgerMeta struct {
	kv       *gocache.Cache
	txTagsMu sync.RWMutex
	txTags   map[int64][]txTagEntry
}

func newLedgerMeta() *LedgerMeta {
	return &LedgerMeta{
		kv:     gocache.New(gocache.NoExpiration, 0),
		txTags: map[int64][]txTagEntry{},
	}
}

func (m *LedgerMeta) putTag(id int64, name string) {
	m.kv.Set(prefixTagName+name, id, gocache.NoExpiration)
	m.kv.Set(prefixTagID+strconv.FormatInt(id, 10), name, gocache.NoExpiration)
}

func (m *LedgerMeta) putContact(id int64, name string) {
	m.kv.Set(prefixContactName+name, id, gocache.NoExpiration)
	m.kv.Set(prefixContactID+strconv.FormatInt(id, 10), name, gocache.NoExpiration)
}

// WarmTagsAndContacts 一次性加载全部标签与联系人到缓存。
func (m *LedgerMeta) WarmTagsAndContacts(q SQLExec) error {
	rows, err := q.Query(`SELECT id, name FROM tags`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return err
		}
		m.putTag(id, name)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	rows, err = q.Query(`SELECT id, name FROM contacts`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return err
		}
		m.putContact(id, name)
	}
	return rows.Err()
}

// LoadTxTags 加载流水标签关联（导出用，每次导出前刷新）。
func (m *LedgerMeta) LoadTxTags(q SQLExec) error {
	rows, err := q.Query(`
		SELECT tt.transaction_id, tt.tag_id, g.name
		FROM transaction_tags tt
		JOIN tags g ON g.id = tt.tag_id
		ORDER BY tt.transaction_id, g.name`)
	if err != nil {
		return err
	}
	defer rows.Close()

	next := map[int64][]txTagEntry{}
	for rows.Next() {
		var txID, tagID int64
		var name string
		if err := rows.Scan(&txID, &tagID, &name); err != nil {
			return err
		}
		next[txID] = append(next[txID], txTagEntry{ID: tagID, Name: name})
	}
	if err := rows.Err(); err != nil {
		return err
	}
	m.txTagsMu.Lock()
	m.txTags = next
	m.txTagsMu.Unlock()
	return nil
}

func (m *LedgerMeta) tagIDCached(name string) (int64, bool) {
	v, ok := m.kv.Get(prefixTagName + name)
	if !ok {
		return 0, false
	}
	id, ok := v.(int64)
	return id, ok
}

func (m *LedgerMeta) contactIDCached(name string) (int64, bool) {
	v, ok := m.kv.Get(prefixContactName + name)
	if !ok {
		return 0, false
	}
	id, ok := v.(int64)
	return id, ok
}

// ResolveTagID 先查缓存，再查库，最后创建并回填。
func (m *LedgerMeta) ResolveTagID(q SQLExec, name string, created *int) (int64, error) {
	name = strings.TrimSpace(name)
	if id, ok := m.tagIDCached(name); ok {
		return id, nil
	}
	var id int64
	err := q.QueryRow(`SELECT id FROM tags WHERE name = ?`, name).Scan(&id)
	if err == nil {
		m.putTag(id, name)
		return id, nil
	}
	if err != sql.ErrNoRows {
		return 0, err
	}
	res, err := q.Exec(`INSERT INTO tags (name, is_system, enabled) VALUES (?, 0, 1)`, name)
	if err != nil {
		return 0, err
	}
	id, err = res.LastInsertId()
	if err != nil {
		return 0, err
	}
	m.putTag(id, name)
	*created++
	return id, nil
}

// ResolveContactID 先查缓存，再查库，最后创建并回填。
func (m *LedgerMeta) ResolveContactID(q SQLExec, name string, created *int) (*int64, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, nil
	}
	if id, ok := m.contactIDCached(name); ok {
		return &id, nil
	}
	var id int64
	err := q.QueryRow(`SELECT id FROM contacts WHERE name = ?`, name).Scan(&id)
	if err == nil {
		m.putContact(id, name)
		return &id, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}
	res, err := q.Exec(`INSERT INTO contacts (name, nickname, relation_group, note, phone) VALUES (?, '', '', '', '')`, name)
	if err != nil {
		return nil, err
	}
	id, err = res.LastInsertId()
	if err != nil {
		return nil, err
	}
	m.putContact(id, name)
	*created++
	return &id, nil
}

// ContactName 先查缓存，未命中再查库并回填。
func (m *LedgerMeta) ContactName(q SQLExec, id int64) (string, error) {
	key := prefixContactID + strconv.FormatInt(id, 10)
	if v, ok := m.kv.Get(key); ok {
		if name, ok := v.(string); ok {
			return name, nil
		}
	}
	var name string
	err := q.QueryRow(`SELECT name FROM contacts WHERE id = ?`, id).Scan(&name)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	m.putContact(id, name)
	return name, nil
}

func (m *LedgerMeta) TxTagNames(txID int64) []string {
	m.txTagsMu.RLock()
	defer m.txTagsMu.RUnlock()
	entries := m.txTags[txID]
	names := make([]string, len(entries))
	for i, e := range entries {
		names[i] = e.Name
	}
	return names
}

// TxTagsForIDs returns tag ids and names per transaction, loading missing rows from DB.
func (m *LedgerMeta) TxTagsForIDs(q SQLExec, txIDs []int64) (map[int64][]int64, map[int64][]string, error) {
	idOut := make(map[int64][]int64, len(txIDs))
	nameOut := make(map[int64][]string, len(txIDs))
	if len(txIDs) == 0 {
		return idOut, nameOut, nil
	}
	missing := make([]int64, 0)
	m.txTagsMu.RLock()
	for _, id := range txIDs {
		if entries, ok := m.txTags[id]; ok {
			ids := make([]int64, len(entries))
			names := make([]string, len(entries))
			for i, e := range entries {
				ids[i] = e.ID
				names[i] = e.Name
			}
			idOut[id] = ids
			nameOut[id] = names
		} else {
			missing = append(missing, id)
		}
	}
	m.txTagsMu.RUnlock()
	if len(missing) == 0 {
		return idOut, nameOut, nil
	}

	placeholders := make([]string, len(missing))
	args := make([]any, len(missing))
	for i, id := range missing {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf(`
		SELECT tt.transaction_id, tt.tag_id, g.name FROM transaction_tags tt
		JOIN tags g ON g.id = tt.tag_id
		WHERE tt.transaction_id IN (%s)
		ORDER BY tt.transaction_id, g.name`, strings.Join(placeholders, ","))
	rows, err := q.Query(query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	fetched := make(map[int64][]txTagEntry, len(missing))
	for rows.Next() {
		var txID, tagID int64
		var name string
		if err := rows.Scan(&txID, &tagID, &name); err != nil {
			return nil, nil, err
		}
		fetched[txID] = append(fetched[txID], txTagEntry{ID: tagID, Name: name})
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	m.txTagsMu.Lock()
	for _, id := range missing {
		entries := fetched[id]
		if entries == nil {
			entries = []txTagEntry{}
		}
		m.txTags[id] = entries
		ids := make([]int64, len(entries))
		names := make([]string, len(entries))
		for i, e := range entries {
			ids[i] = e.ID
			names[i] = e.Name
		}
		idOut[id] = ids
		nameOut[id] = names
	}
	m.txTagsMu.Unlock()
	return idOut, nameOut, nil
}

// ContactNamesBatch resolves contact names using cache, querying misses in one round trip.
func (m *LedgerMeta) ContactNamesBatch(q SQLExec, ids []int64) (map[int64]string, error) {
	out := make(map[int64]string, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	missing := make([]int64, 0)
	for _, id := range ids {
		key := prefixContactID + strconv.FormatInt(id, 10)
		if v, ok := m.kv.Get(key); ok {
			if name, ok := v.(string); ok {
				out[id] = name
				continue
			}
		}
		missing = append(missing, id)
	}
	if len(missing) == 0 {
		return out, nil
	}

	placeholders := make([]string, len(missing))
	args := make([]any, len(missing))
	for i, id := range missing {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf(`SELECT id, name FROM contacts WHERE id IN (%s)`, strings.Join(placeholders, ","))
	rows, err := q.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		m.putContact(id, name)
		out[id] = name
	}
	return out, rows.Err()
}

// EnsureWarm 若缓存为空则预热标签与联系人。
func (m *LedgerMeta) EnsureWarm(q SQLExec) error {
	if m.kv.ItemCount() > 0 {
		return nil
	}
	return m.WarmTagsAndContacts(q)
}
