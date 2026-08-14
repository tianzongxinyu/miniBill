package service

import (
	"testing"
	"time"
)

func TestNextRecurringRunAt(t *testing.T) {
	loc := time.Local
	cases := []struct {
		name string
		now  time.Time
		want time.Time
	}{
		{
			name: "before today 01:00",
			now:  time.Date(2026, 8, 14, 0, 30, 0, 0, loc),
			want: time.Date(2026, 8, 14, 1, 0, 0, 0, loc),
		},
		{
			name: "exactly 01:00",
			now:  time.Date(2026, 8, 14, 1, 0, 0, 0, loc),
			want: time.Date(2026, 8, 15, 1, 0, 0, 0, loc),
		},
		{
			name: "after 01:00",
			now:  time.Date(2026, 8, 14, 15, 0, 0, 0, loc),
			want: time.Date(2026, 8, 15, 1, 0, 0, 0, loc),
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := nextRecurringRunAt(tc.now)
			if !got.Equal(tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}
