package domain

import (
	"fmt"
	"math"
	"math/rand/v2"
)

// TagTextColor 标签文字固定色。
const TagTextColor = "#ffffff"

// 较深背景，配白字可读；HSL 随机失败时的回退池。
var tagBgPalette = []string{
	"#3B6FA8",
	"#7B4FA8",
	"#B45309",
	"#BE3A5A",
	"#5A7A3C",
	"#4F46B5",
	"#C2410C",
	"#0E7490",
	"#8B6914",
	"#4A6B6B",
	"#9D4078",
	"#9B4444",
	"#6B4FA0",
	"#2E7D32",
}

func ValidateTagColorHex(s string) bool {
	if len(s) != 7 || s[0] != '#' {
		return false
	}
	for _, c := range s[1:] {
		ok := (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
		if !ok {
			return false
		}
	}
	return true
}

func RandomTagBg() string {
	for i := 0; i < 24; i++ {
		bg := randomDarkTagBgHSL()
		if tagBgRelativeLuminance(bg) <= 0.42 {
			return bg
		}
	}
	return tagBgPalette[rand.IntN(len(tagBgPalette))]
}

func hslToHex(h, s, l float64) string {
	s /= 100
	l /= 100
	c := (1 - math.Abs(2*l-1)) * s
	x := c * (1 - math.Abs(math.Mod(h/60, 2)-1))
	m := l - c/2

	var r, g, b float64
	switch {
	case h < 60:
		r, g, b = c, x, 0
	case h < 120:
		r, g, b = x, c, 0
	case h < 180:
		r, g, b = 0, c, x
	case h < 240:
		r, g, b = 0, x, c
	case h < 300:
		r, g, b = x, 0, c
	default:
		r, g, b = c, 0, x
	}
	return fmt.Sprintf("#%02x%02x%02x",
		int(math.Round((r+m)*255)),
		int(math.Round((g+m)*255)),
		int(math.Round((b+m)*255)),
	)
}

func randomDarkTagBgHSL() string {
	h := rand.Float64() * 360
	s := 42 + rand.Float64()*38
	l := 30 + rand.Float64()*22
	return hslToHex(h, s, l)
}

func tagBgRelativeLuminance(hex string) float64 {
	if len(hex) != 7 {
		return 1
	}
	parse := func(i int) float64 {
		var v int
		fmt.Sscanf(hex[i:i+2], "%x", &v)
		c := float64(v) / 255
		if c <= 0.03928 {
			return c / 12.92
		}
		return math.Pow((c+0.055)/1.055, 2.4)
	}
	r, g, b := parse(1), parse(3), parse(5)
	return 0.2126*r + 0.7152*g + 0.0722*b
}

// RandomTagColors 随机深色背景 + 固定文字色。
func RandomTagColors() (bg, fg string) {
	return RandomTagBg(), TagTextColor
}
