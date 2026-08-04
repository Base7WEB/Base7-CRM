import pytest


@pytest.fixture
def isolated_data(tmp_path, monkeypatch):
    """Redireciona os arquivos JSON dos services para um diretório temporário,
    garantindo que os testes nunca leiam/escrevam os dados reais do usuário."""
    from services import (
        campaign_service, config_service, conversation_service,
        knowledge_base_service, lead_service, notification_service, template_service,
    )

    monkeypatch.setattr(lead_service, "DATA_FILE", str(tmp_path / "leads.json"))
    monkeypatch.setattr(campaign_service, "CAMPAIGNS_FILE", str(tmp_path / "campaigns.json"))
    monkeypatch.setattr(conversation_service, "CONVERSATIONS_FILE", str(tmp_path / "conversations.json"))
    monkeypatch.setattr(template_service, "TEMPLATES_FILE", str(tmp_path / "templates.json"))
    monkeypatch.setattr(config_service, "CONFIG_FILE", str(tmp_path / "config.json"))
    monkeypatch.setattr(notification_service, "NOTIFICATIONS_FILE", str(tmp_path / "notifications.json"))
    monkeypatch.setattr(knowledge_base_service, "KB_FILE", str(tmp_path / "knowledge_base.json"))

    return tmp_path
