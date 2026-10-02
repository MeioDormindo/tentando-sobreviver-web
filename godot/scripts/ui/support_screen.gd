extends Control
## APOIE O PROJETO: o jogo é gratuito e sem anúncios; um PIX de qualquer valor ajuda a mantê-lo.
## QR Code, chave aleatória e o "copia e cola" para colar no app do banco, e o contato do autor.

const MENU := "res://scenes/ui/main_menu.tscn"

## O que foi copiado por último (os testes leem; a área de transferência pode não existir).
var last_copied := ""
var _message: Label


func _ready() -> void:
	var column := MenuKit.screen(self, 620.0)
	MenuKit.spacer(column, 16)
	MenuKit.title(column, "APOIE O PROJETO", 48)
	MenuKit.label(column, "O Tentando Sobreviver é gratuito e sem anúncios. Se você curtiu, um PIX de qualquer valor ajuda a manter o projeto vivo — totalmente opcional.",
		16, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	# QR Code num quadro claro (o app do banco lê pela câmera).
	var holder := CenterContainer.new()
	column.add_child(holder)
	var frame := PanelContainer.new()
	var light := StyleBoxFlat.new()
	light.bg_color = Color.WHITE
	light.set_content_margin_all(8)
	frame.add_theme_stylebox_override(&"panel", light)
	holder.add_child(frame)
	var qr := TextureRect.new()
	qr.name = "PixQr"
	qr.texture = load(SupportInfo.PIX_QR) if ResourceLoader.exists(SupportInfo.PIX_QR) else null
	qr.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	qr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	qr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	qr.custom_minimum_size = Vector2(212, 212)
	frame.add_child(qr)
	MenuKit.label(column, Loc.t("PIX para %s") % SupportInfo.PIX_NAME, 18, MenuKit.GOLD, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.label(column, Loc.t("Chave aleatória: %s") % SupportInfo.PIX_KEY, 14, MenuKit.TEXT, HORIZONTAL_ALIGNMENT_CENTER).name = "PixKey"
	var copy := MenuKit.button(column, "COPIAR PIX COPIA E COLA", func() -> void: _copy(SupportInfo.PIX_PAYLOAD, "PIX copia e cola copiado! Cole no app do seu banco."), 20)
	copy.name = "CopyPayload"
	MenuKit.button(column, "COPIAR CHAVE", func() -> void: _copy(SupportInfo.PIX_KEY, "Chave PIX copiada!"), 18).name = "CopyKey"
	_message = MenuKit.label(column, "", 15, MenuKit.GOLD, HORIZONTAL_ALIGNMENT_CENTER)
	_message.name = "Message"
	MenuKit.spacer(column, 6)
	MenuKit.label(column, Loc.t("Ideias, bugs ou parcerias: %s") % SupportInfo.EMAIL, 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER).name = "Contact"
	MenuKit.label(column, Loc.t("Desenvolvido por %s") % SupportInfo.DEVELOPER, 14, MenuKit.DIM, HORIZONTAL_ALIGNMENT_CENTER)
	MenuKit.button(column, "VOLTAR", func() -> void: MenuKit.go(self, MENU)).name = "Back"
	copy.grab_focus.call_deferred()


func _copy(text: String, message: String) -> void:
	DisplayServer.clipboard_set(text)
	last_copied = text
	_message.text = message


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		MenuKit.go(self, MENU)
