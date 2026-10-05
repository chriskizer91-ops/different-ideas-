// Temperature lines for frost and heat warnings, °C.
// Frost, freeze and hard freeze match the US National Weather Service's frost
// advisory (36°F), freeze warning (32°F) and hard freeze warning (28°F).
export const COLD_AT = { frost: 2, frostClearCalm: 3.5, freeze: 0, hard: -2.2, extreme: -12.2, extremeFloor: -6.7 };
export const HEAT_AT = { hot: 32.2, veryHot: 35, extreme: 37.8 };
export const SEVERITY = ['', 'Advisory', 'Warning', 'Severe', 'Extreme'];
