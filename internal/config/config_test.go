package config

import "testing"

func TestValidateJWTSecret(t *testing.T) {
	valid := Config{JWTSecret: "abcdefghijklmnopqrstuvwxyz0123456789abcd"}
	if err := valid.Validate(); err != nil {
		t.Fatalf("expected valid secret: %v", err)
	}

	cases := []struct {
		secret string
	}{
		{""},
		{defaultJWTSecret},
		{"dev"},
		{"change-me-in-production"},
		{"change-me-to-a-long-random-string"},
		{"change-me-anything-else-with-enough-length-here"},
		{"short"},
	}
	for _, tc := range cases {
		if err := (Config{JWTSecret: tc.secret}).Validate(); err == nil {
			t.Fatalf("expected error for secret %q", tc.secret)
		}
	}
}
