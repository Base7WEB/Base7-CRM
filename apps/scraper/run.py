import argparse
import os
import sys

import requests
from dotenv import load_dotenv

from scraper import rodar_pesquisa, rodar_instagram

load_dotenv()

API_BASE_URL = os.environ.get("CRM_API_BASE_URL")
AGENT_TOKEN = os.environ.get("CRM_AGENT_TOKEN")


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

    args = parser.parse_args()

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
