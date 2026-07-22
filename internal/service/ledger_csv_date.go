package service

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	reCNDate     = regexp.MustCompile(`^(\d{4})年(\d{1,2})月(\d{1,2})日`)
	reCNDateTime = regexp.MustCompile(`^(\d{4})年(\d{1,2})月(\d{1,2})日[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?`)
)

// parseFlexibleDate parses common date/datetime strings into YYYY-MM-DD (date only).
func parseFlexibleDate(s string) (string, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", fmt.Errorf("%w: tx_date_format", ErrValidation)
	}
	// Strip trailing Z / offset for simple ISO attempts after layout tries
	layouts := []string{
		"2006-01-02",
		"2006/01/02",
		"2006.01.02",
		"2006-01-02 15:04:05",
		"2006/01/02 15:04:05",
		"2006.01.02 15:04:05",
		"2006-01-02 15:04",
		"2006/01/02 15:04",
		"2006.01.02 15:04",
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05-07:00",
		time.RFC3339,
		"01/02/2006",
		"1/2/2006",
		"02-01-2006",
		"2-1-2006",
	}
	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			y, m, d := t.Date()
			if y < 1970 || y > 2100 {
				continue
			}
			return fmt.Sprintf("%04d-%02d-%02d", y, int(m), d), nil
		}
	}
	if m := reCNDateTime.FindStringSubmatch(s); m != nil {
		y, _ := strconv.Atoi(m[1])
		mo, _ := strconv.Atoi(m[2])
		d, _ := strconv.Atoi(m[3])
		if ok := validYMD(y, mo, d); ok {
			return fmt.Sprintf("%04d-%02d-%02d", y, mo, d), nil
		}
	}
	if m := reCNDate.FindStringSubmatch(s); m != nil {
		y, _ := strconv.Atoi(m[1])
		mo, _ := strconv.Atoi(m[2])
		d, _ := strconv.Atoi(m[3])
		if ok := validYMD(y, mo, d); ok {
			return fmt.Sprintf("%04d-%02d-%02d", y, mo, d), nil
		}
	}
	return "", fmt.Errorf("%w: tx_date_format", ErrValidation)
}

func validYMD(y, m, d int) bool {
	if y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31 {
		return false
	}
	t := time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC)
	return t.Year() == y && int(t.Month()) == m && t.Day() == d
}
