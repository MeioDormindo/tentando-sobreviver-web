extends Node
## Idiomas (autoload "Loc"). O jogo é escrito em português: o texto em português é a chave do
## catálogo (godot/locale/*.po, gerado por npm run godot:i18n) e é traduzido para outros 14
## idiomas. Na primeira vez o jogo abre no idioma do aparelho (PC, navegador ou celular), ou em
## inglês se ele não estiver na lista; a troca fica nas Configurações (JOGO → IDIOMA).
##
## `Label` e `Button` traduzem sozinhos um texto fixo. Texto montado: `Loc.t("modelo %s") % x`.
## Texto que vai pela rede (feed, avisos, dicas, objetivos) não pode ir pronto, senão o colega
## veria o idioma do host: `fmt()` junta o modelo e os argumentos e quem mostra chama `text()`, que
## traduz tudo na máquina de quem lê.

## Código do Godot → nome no próprio idioma (a ordem da lista nas Configurações).
const LANGUAGES := {
	"en": "English", "pt_BR": "Português (Brasil)", "es": "Español", "fr": "Français",
	"de": "Deutsch", "it": "Italiano", "ru": "Русский", "uk": "Українська", "pl": "Polski",
	"tr": "Türkçe", "id": "Bahasa Indonesia", "zh_CN": "简体中文", "zh_TW": "繁體中文",
	"ja": "日本語", "ko": "한국어",
}
## Fonte de reserva (pixel) dos idiomas fora do alfabeto latino e do cirílico.
const CJK_FONTS := {
	"zh_CN": "res://assets/fonts/cjk_zh_CN.ttf", "zh_TW": "res://assets/fonts/cjk_zh_TW.ttf",
	"ja": "res://assets/fonts/cjk_ja.ttf", "ko": "res://assets/fonts/cjk_ko.ttf",
}
## Só os caracteres dos nomes desses idiomas (日本語, 한국어...): reserva em qualquer idioma, para a
## lista das Configurações.
const NAMES_FONT := "res://assets/fonts/cjk_names.ttf"
## Tamanho em que a Fusion Pixel foi desenhada.
const CJK_PIXEL_SIZE := 12
## Separa o modelo dos argumentos numa mensagem de `fmt()`.
const SEP := "\u001F"
## Separa as mensagens juntadas por `cat()`.
const JOIN := "\u001E"
## Argumento que sai em maiúsculas depois de traduzido.
const UPPER := "\u0001"
## Argumento que é uma ação: vira a tecla dela na máquina de quem lê ("[E]").
const KEY := "\u0002"

## Idioma em uso (código da lista).
var current := "pt_BR"
## Idioma fixo, acima da configuração (testes e prints: `-- --lang=en` na linha de comando).
var forced := ""


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--lang="):
			forced = arg.trim_prefix("--lang=")
	apply()


## O idioma do aparelho na lista (função pura): pt* → pt_BR; zh de Taiwan, Hong Kong, Macau ou da
## escrita tradicional → zh_TW; outro zh → zh_CN; "in" (código antigo do indonésio) → id; senão as
## duas letras do começo, ou o inglês.
static func detect(os_locale: String) -> String:
	var code := os_locale.replace("-", "_")
	var lang := code.get_slice("_", 0).to_lower()
	if lang == "pt":
		return "pt_BR"
	if lang == "zh":
		var rest := code.to_upper()
		return "zh_TW" if rest.contains("_TW") or rest.contains("_HK") or rest.contains("_MO") or rest.contains("HANT") else "zh_CN"
	if lang == "in":
		return "id"
	return lang if LANGUAGES.has(lang) else "en"


## O idioma de uma configuração ("auto" = o do aparelho).
static func wanted(setting: String, os_locale: String) -> String:
	return setting if LANGUAGES.has(setting) else detect(os_locale)


## Aplica o idioma da configuração (na hora: as telas se refazem e os rótulos se retraduzem).
func apply() -> void:
	var chosen := wanted(forced if forced != "" else String(Save.get_setting("language")), OS.get_locale())
	var changed := chosen != current or TranslationServer.get_locale() != chosen
	current = chosen
	TranslationServer.set_locale(current)
	_set_font_fallback()
	if changed:
		Events.language_changed.emit(current)


## Chinês, japonês e coreano: a fonte pixel do idioma entra como reserva da fonte do jogo. A dos
## nomes dos idiomas fica sempre por último.
func _set_font_fallback() -> void:
	var font := load(String(ProjectSettings.get_setting("gui/theme/custom_font"))) as Font
	if font == null:
		return
	var fallbacks: Array[Font] = []
	for path: String in [String(CJK_FONTS.get(current, "")), NAMES_FONT]:
		if path != "" and ResourceLoader.exists(path):
			var cjk := load(path) as FontFile
			# Desenhada em 12 px: desenha nesse tamanho e só amplia por inteiro (fica nítida ao lado
			# da fonte pixel, que também só cresce em múltiplos).
			cjk.fixed_size = CJK_PIXEL_SIZE
			cjk.fixed_size_scale_mode = TextServer.FIXED_SIZE_SCALE_INTEGER_ONLY
			fallbacks.append(cjk)
	font.fallbacks = fallbacks


## Opções da configuração de idioma: "auto" e os 15 da lista.
static func choices() -> Array:
	return ["auto"] + LANGUAGES.keys()


## Como cada opção aparece nas Configurações (o nome no próprio idioma; "auto" diz qual é).
static func choice_label(value: Variant) -> String:
	if LANGUAGES.has(String(value)):
		return LANGUAGES[String(value)]
	return t("AUTOMÁTICO (%s)") % LANGUAGES[detect(OS.get_locale())]


## Traduz um texto (a chave é o texto em português). Arma melhorada ("Tornado Mk II") traduz o
## nome e mantém o Mk.
static func t(msgid: String) -> String:
	var out := String(TranslationServer.translate(msgid))
	if out == msgid:
		for suffix: String in [" Mk III", " Mk II"]:
			if msgid.ends_with(suffix):
				return String(TranslationServer.translate(msgid.trim_suffix(suffix))) + suffix
	return out


## Mensagem para a rede (ou para a HUD de outro jogador): o modelo e os argumentos juntos. Os
## argumentos viram texto; use %s no modelo.
static func fmt(msgid: String, args: Array = []) -> String:
	var parts := PackedStringArray([msgid])
	for arg: Variant in args:
		parts.append(str(arg))
	return SEP.join(parts)


## Várias mensagens em sequência (cada uma de `fmt()` ou texto comum), mostradas juntas.
static func cat(parts: Array) -> String:
	return JOIN.join(PackedStringArray(parts.map(func(part: Variant) -> String: return str(part))))


## Argumento de `fmt()` que deve sair em maiúsculas depois de traduzido.
static func up(text: Variant) -> String:
	return UPPER + str(text)


## Argumento de `fmt()` que vira a tecla da ação na máquina de quem lê.
static func key(action: StringName) -> String:
	return KEY + String(action)


## Texto pronto para mostrar: traduz o modelo e cada argumento e monta (texto comum só traduz).
static func text(message: String) -> String:
	if message.contains(JOIN):
		var pieces := PackedStringArray()
		for part in message.split(JOIN):
			pieces.append(text(part))
		return "".join(pieces)
	if not message.contains(SEP):
		return _piece(message)
	var parts := message.split(SEP)
	var args: Array = []
	for i in range(1, parts.size()):
		args.append(_piece(parts[i]))
	var template := t(parts[0])
	return template % args if template.contains("%") else template


static func _piece(piece: String) -> String:
	if piece.begins_with(UPPER):
		return t(piece.substr(1)).to_upper()
	if piece.begins_with(KEY):
		return InputBindings.hint_label(StringName(piece.substr(1)))
	return t(piece)
