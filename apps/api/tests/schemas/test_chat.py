from schemas.chat import ChatMessage, ChatRequest


def test_chat_message_roles():
    m = ChatMessage(role="user", content="Merhaba")
    assert m.role == "user"


def test_chat_request_history_optional():
    r = ChatRequest(message="Bu ay KDV ne kadar?", job_id="job-1")
    assert r.history == []
