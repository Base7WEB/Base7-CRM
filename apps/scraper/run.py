import argparse
import os
import sys
import time

import requests
from dotenv import load_dotenv

from scraper import rodar_pesquisa, rodar_instagram

load_dotenv()

API_BASE_URL = os.environ.get("CRM_API_BASE_URL")
AGENT_TOKEN = os.environ.get("CRM_AGENT_TOKEN")

_TICK_SEGUNDOS = 6


def enviar_leads(leads):
    if not leads:
        print("[scraper] Nenhum lead coletado.")
        return

    resp = requests.post(
        f"{API_BASE_URL}/api/agent/scraper/leads",
        json={"leads": leads},
        headers={"Authorization": f"Bearer {AGENT_TOKEN}"},
        timeout=30,
    )
    if not resp.ok:
        print(f"[scraper] Erro ao enviar leads ao CRM: {resp.status_code} {resp.text}")
        return

    result = resp.json()
    print(
        f"[scraper] CRM recebeu {len(leads)} leads: "
        f"{result.get('inseridos', 0)} novos, {result.get('duplicados', 0)} já existiam, "
        f"{result.get('rejeitados', 0)} rejeitados."
    )


def _buscar_proximo_job():
    resp = requests.get(
        f"{API_BASE_URL}/api/agent/scraper/jobs/next",
        headers={"Authorization": f"Bearer {AGENT_TOKEN}"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json().get("job")


def _reportar_resultado(job_id, status, leads=None, erro=None):
    payload = {"status": status}
    if leads is not None:
        payload["leads"] = leads
    if erro is not None:
        payload["erro"] = erro
    resp = requests.patch(
        f"{API_BASE_URL}/api/agent/scraper/jobs/{job_id}",
        json=payload,
        headers={"Authorization": f"Bearer {AGENT_TOKEN}"},
        timeout=30,
    )
    if not resp.ok:
        print(f"[scraper] Falha ao reportar resultado do job {job_id}: {resp.status_code} {resp.text}")


def watch():
    """Fica de pé escutando a fila de prospecção do CRM (tela Prospecção) --
    mesmo padrão de polling do wa-agent, só que pra pedidos de busca em vez
    de mensagens."""
    print("[scraper] Modo fila ativo -- escutando pedidos de busca feitos na tela Prospecção do CRM.")
    print("[scraper] Pra desligar, feche esta janela.")
    while True:
        try:
            job = _buscar_proximo_job()
        except Exception as e:
            print(f"[scraper] Erro consultando a fila: {e}")
            time.sleep(_TICK_SEGUNDOS)
            continue

        if not job:
            time.sleep(_TICK_SEGUNDOS)
            continue

        job_id = job["id"]
        modo = job["modo"]
        p = job.get("params") or {}
        print(f"[scraper] Novo pedido ({modo}): {p}")

        try:
            if modo == "maps":
                leads = rodar_pesquisa(
                    nicho=p.get("nicho", ""),
                    cidade=p.get("cidade", ""),
                    raio_km=p.get("raio_km", 10),
                    rating_min=p.get("rating_min", 0),
                    max_resultados=p.get("max_resultados", 20),
                    enriquecer=p.get("enriquecer", False),
                )
            else:
                leads = rodar_instagram(hashtag=p.get("hashtag", ""), max_resultados=p.get("max_resultados", 20))

            _reportar_resultado(job_id, "CONCLUIDO", leads=leads)
            print(f"[scraper] Pedido concluído: {len(leads)} lead(s) encontrados. Volte na tela Prospecção pra revisar e importar.")
        except Exception as e:
            _reportar_resultado(job_id, "ERRO", erro=str(e))
            print(f"[scraper] Pedido falhou: {e}")


def main():
    if not API_BASE_URL or not AGENT_TOKEN:
        print("[scraper] Faltam variáveis de ambiente. Configure CRM_API_BASE_URL e CRM_AGENT_TOKEN no .env.")
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Scraper de leads do BASE7 CRM (Google Maps / Instagram)")
    sub = parser.add_subparsers(dest="modo", required=True)

    maps = sub.add_parser("maps", help="Buscar no Google Maps")
    maps.add_argument("--nicho", required=True)
    maps.add_argument("--cidade", required=True)
    maps.add_argument("--raio-km", type=float, default=10)
    maps.add_argument("--rating-min", type=float, default=0)
    maps.add_argument("--max-resultados", type=int, default=20)
    maps.add_argument("--enriquecer", action="store_true", help="Tenta extrair e-mail do site de cada lead")

    insta = sub.add_parser("instagram", help="Buscar por hashtag no Instagram (experimental)")
    insta.add_argument("--hashtag", required=True)
    insta.add_argument("--max-resultados", type=int, default=20)

    sub.add_parser("watch", help="Escuta a fila de pedidos feitos na tela Prospecção do CRM (fica rodando)")

    args = parser.parse_args()

    if args.modo == "watch":
        watch()
        return

    if args.modo == "maps":
        leads = rodar_pesquisa(
            nicho=args.nicho,
            cidade=args.cidade,
            raio_km=args.raio_km,
            rating_min=args.rating_min,
            max_resultados=args.max_resultados,
            enriquecer=args.enriquecer,
        )
    else:
        leads = rodar_instagram(hashtag=args.hashtag, max_resultados=args.max_resultados)

    enviar_leads(leads)


if __name__ == "__main__":
    main()
