package service

import (
	"testing"
	"time"
)

func TestNextBackupScanAt(t *testing.T) {
	loc := time.Local
	cases := []struct {
		name string
		now  time.Time
		want time.Time
	}{
		{
			name: "exactly midnight",
			now:  time.Date(2026, 8, 14, 0, 0, 0, 0, loc),
			want: time.Date(2026, 8, 14, 0, 5, 0, 0, loc),
		},
		{
			name: "between slots",
			now:  time.Date(2026, 8, 14, 0, 3, 0, 0, loc),
			want: time.Date(2026, 8, 14, 0, 5, 0, 0, loc),
		},
		{
			name: "exactly on slot",
			now:  time.Date(2026, 8, 14, 0, 10, 0, 0, loc),
			want: time.Date(2026, 8, 14, 0, 15, 0, 0, loc),
		},
		{
			name: "near end of day",
			now:  time.Date(2026, 8, 14, 23, 57, 0, 0, loc),
			want: time.Date(2026, 8, 15, 0, 0, 0, 0, loc),
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := nextBackupScanAt(tc.now)
			if !got.Equal(tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}
