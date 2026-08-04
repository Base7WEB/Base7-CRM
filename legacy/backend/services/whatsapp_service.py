from services import conversation_service, lead_service
from whatsapp import normalizar_telefone
from whatsapp.manager import whatsapp_manager


class WhatsAppService:
    """Fachada síncrona sobre o WhatsAppManager (assíncrono), usada pelas rotas Flask."""

    def __init__(self, manager=None):
        self.manager = manager or whatsapp_manager
        self.manager.on_mensagem_recebida = self._processar_mensagem_recebida

    def _processar_mensagem_recebida(self, telefone, nome, texto):
        conversation_service.processar_mensagem_recebida(telefone, nome, texto)

    def status(self):
        return self.manager.get_status()

    def qr(self):
        return {"qr": self.manager.get_qr()}

    def connect(self):
        self.manager.connect()
        return self.manager.get_status()

    def disconnect(self):
        self.manager.disconnect()
        return self.manager.get_status()

    def check_number(self, telefone):
        return self.manager.verificar_numero(telefone)

    def send_to_lead(self, lead_id, texto, campanha_id=None):
        """Envia uma mensagem para o telefone de um lead e registra o histórico/conversa."""
        lead = lead_service.obter_lead(lead_id)
        if not lead:
            return {"ok": False, "erro": "Lead não encontrado"}, 404

        telefone = lead.get("telefone", "")
        if not telefone:
            return {"ok": False, "erro": "Lead não possui telefone cadastrado"}, 400

        telefone_normalizado = normalizar_telefone(telefone)
        resultado = self.manager.enviar_mensagem(telefone_normalizado, texto)

        if resultado.get("ok"):
            conversation_service.registrar_mensagem(
                lead_id, telefone_normalizado, texto, direcao="enviada", campanha_id=campanha_id,
            )
            acao = "Mensagem enviada via WhatsApp"
            if campanha_id:
                acao += f" (campanha {campanha_id})"

            def _marcar_envio(lead):
                lead.setdefault("historico", []).append({"data": lead_service.agora(), "acao": acao})
                lead["telefone_normalizado"] = telefone_normalizado

            lead_service.atualizar_lead(lead_id, _marcar_envio)
            return resultado, 200

        return resultado, 502


whatsapp_service = WhatsAppService()
