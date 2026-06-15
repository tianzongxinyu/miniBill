package domain

import "testing"

func TestRandomTagColorsFixedText(t *testing.T) {
	for i := 0; i < 30; i++ {
		bg, fg := RandomTagColors()
		if !ValidateTagColorHex(bg) {
			t.Fatalf("invalid bg %s", bg)
		}
		if fg != TagTextColor {
			t.Fatalf("fg = %s, want %s", fg, TagTextColor)
		}
		if tagBgRelativeLuminance(bg) > 0.42 {
			t.Fatalf("bg %s too light for white text", bg)
		}
	}
}
