class_name SupportInfo
extends RefCounted
## Quem fez o jogo e como apoiar (rodapé do menu e tela APOIE O PROJETO). O PIX é a chave
## aleatória do autor (não expõe CPF nem telefone), a mesma dos outros projetos dele; o "copia e
## cola" já vem com o CRC, e o QR em assets/ui/pix_qr.svg foi gerado deste mesmo texto.

const DEVELOPER := "Siryus Canuto"
const EMAIL := "siryuscanuto@gmail.com"
const PIX_KEY := "2108ccd9-3137-493e-a1a0-65da48ea840c"
const PIX_NAME := "Siryus Canuto"
const PIX_PAYLOAD := "00020126580014br.gov.bcb.pix01362108ccd9-3137-493e-a1a0-65da48ea840c5204000053039865802BR5913Siryus Canuto6009SAO PAULO62070503***6304378B"
const PIX_QR := "res://assets/ui/pix_qr.svg"


## "Desenvolvido por ..." e o e-mail embaixo (topo do menu principal).
static func credit_line() -> String:
	return Loc.t("Desenvolvido por %s\n%s") % [DEVELOPER, EMAIL]
