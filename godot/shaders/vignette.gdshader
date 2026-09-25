// Vinheta da tela: escurece as bordas, mais nas áreas escuras (força vem da HUD).
shader_type canvas_item;

uniform float strength : hint_range(0.0, 1.0) = 0.4;

void fragment() {
	vec2 d = (UV - 0.5) * vec2(1.35, 1.0);
	float v = smoothstep(0.22, 0.85, length(d) * 1.25);
	COLOR = vec4(0.0, 0.0, 0.02, v * v * strength);
}
