// Personagem em pixel art (CharacterSprite): quadro voltado para a câmera, pixels nítidos,
// iluminado pela cena. O quadro é chegado para perto da câmera ao longo do raio de visão
// (mesmo lugar e tamanho na tela): assim os pés e as pernas não "entram" no chão nem nos
// objetos logo atrás do personagem, e só o que está mesmo na frente dele o cobre.
shader_type spatial;
render_mode skip_vertex_transform, cull_disabled, depth_prepass_alpha, diffuse_lambert, specular_disabled;

uniform sampler2D tex : source_color, filter_nearest;
/// Quanto o quadro chega para perto da câmera (m).
uniform float toward_camera = 0.9;
/// Brilho próprio por personagem (zumbi dourado): cor × força em alfa.
instance uniform vec4 glow_color = vec4(0.0);

void vertex() {
	// Billboard: eixos da câmera, com a escala do nó.
	vec3 scale_xyz = vec3(length(MODEL_MATRIX[0].xyz), length(MODEL_MATRIX[1].xyz), length(MODEL_MATRIX[2].xyz));
	vec3 world = MODEL_MATRIX[3].xyz
		+ INV_VIEW_MATRIX[0].xyz * VERTEX.x * scale_xyz.x
		+ INV_VIEW_MATRIX[1].xyz * VERTEX.y * scale_xyz.y;
	vec4 view = VIEW_MATRIX * vec4(world, 1.0);
	// Chega perto ao longo do raio da câmera (a projeção na tela não muda).
	float z = view.z;
	float closer = min(z + toward_camera, -0.05);
	view.xyz *= closer / z;
	VERTEX = view.xyz;
	NORMAL = vec3(0.0, 0.0, 1.0);
}

void fragment() {
	vec4 color = texture(tex, UV) * COLOR;
	if (color.a < 0.5) {
		discard;
	}
	ALBEDO = color.rgb;
	ROUGHNESS = 1.0;
	EMISSION = color.rgb * glow_color.rgb * glow_color.a;
}
