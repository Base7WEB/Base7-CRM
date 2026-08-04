import asyncio
import threading


class BackgroundLoop:
    """Event loop asyncio de longa duração rodando em thread própria.

    O WhatsApp Web precisa de uma sessão (browser) viva entre requisições HTTP,
    diferente do scraper de prospecção que usa asyncio.run() descartável por chamada.
    Rotas Flask (síncronas) agendam corrotinas aqui via run()/submit().
    """

    def __init__(self):
        self._loop = None
        self._thread = None
        self._ready = threading.Event()

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._ready.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        self._ready.wait(timeout=10)

    def _run(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._ready.set()
        self._loop.run_forever()

    def run(self, coro, timeout=None):
        """Agenda uma corrotina e bloqueia até o resultado (uso em rotas síncronas)."""
        if not self._loop:
            raise RuntimeError("Loop de background não iniciado")
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result(timeout=timeout)

    def submit(self, coro):
        """Agenda uma corrotina sem esperar (fire-and-forget), retorna o Future."""
        if not self._loop:
            raise RuntimeError("Loop de background não iniciado")
        return asyncio.run_coroutine_threadsafe(coro, self._loop)

    @property
    def ativo(self):
        return bool(self._loop and self._thread and self._thread.is_alive())
