// Decoração em pixel art (peças de parede e decalques de chão): textura com pixels nítidos,
// brilho opcional (luminária, placa de saída) e, nas peças de parede, a mesma oclusão das
// paredes — some junto com o círculo pontilhado em volta do jogador.
shader_type spatial;
render_mode cull_disabled;

uniform sampler2D tex : source_color, filter_nearest;
uniform vec3 glow = vec3(0.0);
uniform bool occlude = true;
uniform float occlusion_radius = 0.14;

global uniform vec2 occlusion_screen;
global uniform float occlusion_view_z;
global uniform float occlusion_aspect;

float bayer4(vec2 p) {
	int x = int(mod(p.x, 4.0));
	int y = int(mod(p.y, 4.0));
	int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
	return (float(m[x + y * 4]) + 0.5) / 16.0;
}

void fragment() {
	vec4 color = texture(tex, UV);
	if (color.a < 0.5) {
		discard;
	}
	ALBEDO = color.rgb;
	ROUGHNESS = 0.9;
	if (length(glow) > 0.0) {
		EMISSION = color.rgb * glow * 1.4;
	}
	if (occlude) {
		vec2 d = SCREEN_UV - occlusion_screen;
		d.x *= occlusion_aspect;
		float t = length(d) / occlusion_radius;
		if (t < 1.0 && VERTEX.z > occlusion_view_z + 0.4 && bayer4(floor(FRAGCOORD.xy / 2.0)) > smoothstep(0.55, 1.0, t)) {
			discard;
		}
	}
}
