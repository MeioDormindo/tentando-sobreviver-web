// Parede 2.5D: arte do jogo web aplicada pela posição no mundo (32 px = 1 m) e oclusão —
// onde a parede fica entre a câmera e o jogador, abre um círculo com pontilhado pixelado
// (dither 4×4) para ele continuar visível. Posição do jogador vem de CameraOcclusion.
shader_type spatial;

uniform sampler2D side_texture : source_color, filter_nearest_mipmap, repeat_enable;
uniform sampler2D top_texture : source_color, filter_nearest_mipmap, repeat_enable;
// Quantos metros cada imagem cobre (largura, altura).
uniform vec2 side_size = vec2(2.0, 3.0);
uniform vec2 top_size = vec2(2.0, 2.0);
// Raio do círculo (fração da altura da tela).
uniform float occlusion_radius = 0.14;

global uniform vec2 occlusion_screen;
global uniform float occlusion_view_z;
global uniform float occlusion_aspect;

varying vec3 world_pos;
varying vec3 world_normal;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

float bayer4(vec2 p) {
	int x = int(mod(p.x, 4.0));
	int y = int(mod(p.y, 4.0));
	int index = x + y * 4;
	int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
	return (float(m[index]) + 0.5) / 16.0;
}

void fragment() {
	vec3 n = abs(world_normal);
	vec3 color;
	if (n.y > 0.5) {
		color = texture(top_texture, world_pos.xz / top_size).rgb;
	} else if (n.x > n.z) {
		color = texture(side_texture, vec2(world_pos.z, -world_pos.y) / side_size).rgb;
	} else {
		color = texture(side_texture, vec2(world_pos.x, -world_pos.y) / side_size).rgb;
	}
	ALBEDO = color;
	ROUGHNESS = 0.95;
	// Oclusão: só a parte da parede mais perto da câmera que o jogador.
	vec2 d = SCREEN_UV - occlusion_screen;
	d.x *= occlusion_aspect;
	float t = length(d) / occlusion_radius;
	if (t < 1.0 && VERTEX.z > occlusion_view_z + 0.4) {
		// Centro vazado, borda pontilhada em pixels grandes (2×2).
		if (bayer4(floor(FRAGCOORD.xy / 2.0)) > smoothstep(0.55, 1.0, t)) {
			discard;
		}
	}
}
