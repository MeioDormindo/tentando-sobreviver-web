class_name OnlineData
extends Resource
## Serviços online (gerado a partir do jogo web): o mesmo Supabase. A chave publicável é
## pública por natureza; quem protege os dados são as regras do banco (supabase/*.sql).
## URL vazia = jogo offline.

@export var url: String = ""
@export var publishable_key: String = ""
## Temporada do ranking global (15 dias, em segundos — igual ao servidor).
@export var season_seconds: int = 1296000
## Tempo máximo de uma requisição (s).
@export var timeout: float = 8.0
@export var global_rank_size: int = 10
@export_group("Conta")
## Usuário vira e-mail sintético usuario@<domínio> (.invalid nunca recebe e-mail).
@export var email_domain: String = ""
@export var username_pattern: String = "^[a-z0-9_]{3,16}$"
@export var password_min: int = 6
@export var password_max: int = 72
## Renova o token quando faltar menos que isto (s).
@export var refresh_margin: float = 60.0
## Espera depois da última mudança do save antes de enviar à nuvem (s).
@export var sync_debounce: float = 4.0


func is_configured() -> bool:
	return url != "" and publishable_key != ""
