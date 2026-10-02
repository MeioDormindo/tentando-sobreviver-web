class_name Signaling
extends RefCounted
## Mensagens de combinação do WebRTC entre os peers de uma sala (entrar, aceitar, recusar,
## oferta, resposta, candidatos de rede). A base é a versão em memória, usada nos testes (dois
## transportes no mesmo processo); o jogo usa a do Supabase (SupabaseSignaling).

## Chegou uma mensagem de `from` (1 = host).
signal message(from: int, kind: String, payload: Dictionary)
## A sinalização falhou (sem internet, sala apagada...).
signal failed(reason: String)

var code := ""
## Peer desta ponta (1 = host).
var me := 1

## Caixas em memória: "código/peer" → [[de, tipo, conteúdo], ...].
static var _boxes: Dictionary = {}


## Envia para `to`, na ordem em que foi chamado.
func send(to: int, kind: String, payload: Dictionary = {}) -> void:
	var key := "%s/%d" % [code, to]
	if not _boxes.has(key):
		_boxes[key] = []
	(_boxes[key] as Array).append([me, kind, payload.duplicate(true)])


## Entrega o que chegou (chamado a cada quadro pelo transporte).
func poll(_delta: float) -> void:
	var key := "%s/%d" % [code, me]
	var inbox: Array = _boxes.get(key, [])
	_boxes.erase(key)
	for entry: Array in inbox:
		message.emit(int(entry[0]), String(entry[1]), entry[2])


## Para de receber (saiu da sala ou já conectou).
func close() -> void:
	_boxes.erase("%s/%d" % [code, me])
