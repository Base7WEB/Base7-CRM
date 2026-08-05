import asyncio
import random
import re
from playwright.async_api import async_playwright

try:
    from playwright_stealth import stealth_async
    _STEALTH = True
except ImportError:
    _STEALTH = False
    async def stealth_async(page): pass


async def pesquisar_google_maps(nicho, cidade, raio_km, rating_min, max_resultados, callback=None, enriquecer=False):
    query     = f"{nicho} em {cidade}"
    url_busca = f"https://www.google.com/maps/search/{query.replace(' ', '+')}"
    resultados = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--lang=pt-BR,en-US"]
        )
        context = await browser.new_context(
            viewport={"width": 1366, "height": 768},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            locale="pt-BR",
        )
        page = await context.new_page()

        if _STEALTH:
            await stealth_async(page)

        print(f"\n[Scraper] Buscando: {query}")
        await page.goto(url_busca, wait_until="domcontentloaded", timeout=30000)
        await _delay(2, 3)

        await _aceitar_cookies(page)
        await _delay(2, 3)

        feed_ok = False
        for sel in ['div[role="feed"]', '.m6QErb[aria-label]', '.m6QErb']:
            try:
                await page.wait_for_selector(sel, timeout=12000)
                print(f"[Scraper] Painel encontrado: {sel}")
                feed_ok = True
                break
            except Exception:
                pass

        if not feed_ok:
            print("[Scraper] ERRO: painel de resultados não apareceu")
            await browser.close()
            return resultados

        # Fase 1: Coletar URLs
        urls = await _coletar_urls(page, max_resultados)
        print(f"[Scraper] {len(urls)} URLs coletadas. Visitando...")

        # Fase 2: Extrair detalhes
        for idx, url in enumerate(urls[:max_resultados]):
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                await _delay(1.5, 2.5)

                lead = await _extrair_detalhe(page)
                if not lead:
                    continue
                lead["google_maps_url"] = url

                if rating_min > 0 and lead.get("rating_google", 0) < rating_min:
                    print(f"[Scraper] × Filtrado (rating): {lead.get('empresa')}")
                    continue

                # Enriquecimento: extrai e-mail do site do lead
                if enriquecer and lead.get("site"):
                    lead["email"] = await _extrair_email_site(page, lead["site"])

                resultados.append(lead)
                if callback:
                    callback(len(resultados), len(urls))
                print(f"[Scraper] ✓ {len(resultados)}. {lead.get('empresa')} ⭐{lead.get('rating_google',0)} 📞{bool(lead.get('telefone'))}")

            except Exception as e:
                print(f"[Scraper] Erro ao processar #{idx}: {e}")
                continue

        await browser.close()

    print(f"\n[Scraper] Finalizado. Total: {len(resultados)} leads.")
    return resultados


async def _coletar_urls(page, max_resultados):
    urls     = set()
    sem_novo = 0

    while len(urls) < max_resultados and sem_novo < 8:
        try:
            hrefs = await page.eval_on_selector_all(
                'a[href*="/maps/place/"]',
                'els => [...new Set(els.map(e => e.href))].filter(h => h.includes("/maps/place/"))'
            )
            novos = set(hrefs) - urls
            if novos:
                urls.update(novos)
                sem_novo = 0
                print(f"[Scraper] URLs: {len(urls)}")
            else:
                sem_novo += 1

            fim = await page.query_selector('span.HlvSq')
            if fim:
                break

        except Exception as e:
            print(f"[Scraper] Erro ao coletar URLs: {e}")
            sem_novo += 1

        await _scroll_lista(page)
        await _delay(1, 1.8)

    return list(urls)


async def _extrair_detalhe(page):
    lead = {}

    try:
        await page.wait_for_selector("h1", timeout=8000)
        lead["empresa"] = (await page.inner_text("h1")).strip()
    except Exception:
        return None

    if not lead.get("empresa"):
        return None

    # Rating
    lead["rating_google"] = 0
    for sel in [
        'span[aria-label*="estrela"]',
        'div.F7nice span[aria-hidden="true"]',
        '.F7nice > span > span[aria-hidden]',
    ]:
        try:
            el = await page.query_selector(sel)
            if el:
                txt = (await el.inner_text()).replace(",", ".").strip()
                lead["rating_google"] = float(txt)
                break
        except Exception:
            pass

    # Reviews
    lead["reviews_google"] = 0
    for sel in [
        'span[aria-label*="avaliações"]',
        'span[aria-label*="reviews"]',
        'div.F7nice span[aria-label]',
    ]:
        try:
            el = await page.query_selector(sel)
            if el:
                txt  = await el.get_attribute("aria-label") or ""
                nums = re.findall(r"\d+", txt.replace(".", "").replace(",", ""))
                if nums:
                    lead["reviews_google"] = int(nums[0])
                    break
        except Exception:
            pass

    # Telefone
    lead["telefone"] = ""
    for sel in [
        'button[data-item-id*="phone"]',
        'a[href^="tel:"]',
        'button[aria-label*="telefone"]',
        'button[aria-label*="Telefone"]',
    ]:
        try:
            el = await page.query_selector(sel)
            if el:
                if sel.startswith("a"):
                    href = await el.get_attribute("href") or ""
                    lead["telefone"] = href.replace("tel:", "").strip()
                else:
                    txt  = await el.get_attribute("aria-label") or await el.inner_text() or ""
                    nums = re.sub(r"[^\d\s\-\(\)\+]", "", txt).strip()
                    if len(re.sub(r"\D", "", nums)) >= 8:
                        lead["telefone"] = nums
                if lead["telefone"]:
                    break
        except Exception:
            pass

    # Site
    lead["site"] = ""
    for sel in [
        'a[data-item-id="authority"]',
        'a[data-value="Website"]',
        'a[aria-label*="site"]',
        'a[aria-label*="Site"]',
    ]:
        try:
            el = await page.query_selector(sel)
            if el:
                lead["site"] = await el.get_attribute("href") or ""
                if lead["site"]:
                    break
        except Exception:
            pass

    # Endereço
    lead["endereco"] = ""
    for sel in [
        'button[data-item-id*="address"]',
        'button[aria-label*="Endereço"]',
        'button[aria-label*="endereço"]',
    ]:
        try:
            el = await page.query_selector(sel)
            if el:
                lead["endereco"] = (await el.inner_text()).strip()
                if lead["endereco"]:
                    break
        except Exception:
            pass

    # Categoria
    lead["nicho"] = ""
    for sel in ["button.DkEaL", "span.mgr77e", ".DkEaL", 'button[jsaction*="category"]']:
        try:
            el = await page.query_selector(sel)
            if el:
                lead["nicho"] = (await el.inner_text()).strip()
                if lead["nicho"]:
                    break
        except Exception:
            pass

    lead["origem"] = "Google Maps"
    lead["status"] = "Novo"
    lead["email"]  = ""
    return lead


async def _extrair_email_site(page, url_site):
    """Visita o site e tenta extrair um endereço de e-mail."""
    try:
        await page.goto(url_site, wait_until="domcontentloaded", timeout=12000)
        await _delay(0.8, 1.5)
        texto = await page.inner_text("body")
        emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", texto)
        # Filtra e-mails genéricos
        ignorar = ["example.com", "seusite", "email.com", "domain.com", "site.com"]
        for e in emails:
            if not any(ig in e.lower() for ig in ignorar):
                return e.lower()
    except Exception:
        pass
    return ""


async def pesquisar_instagram(hashtag, max_resultados=20, callback=None):
    """Pesquisa básica no Instagram por hashtag (perfis de negócios)."""
    url     = f"https://www.instagram.com/explore/tags/{hashtag.lstrip('#')}/"
    leads   = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        context = await browser.new_context(
            viewport={"width": 1366, "height": 768},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            locale="pt-BR",
        )
        page = await context.new_page()
        print(f"[Instagram] Acessando hashtag: #{hashtag}")

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await _delay(3, 5)

            # Verifica se redirecionou para login
            if "login" in page.url or "accounts" in page.url:
                print("[Instagram] Requer login — funcionalidade limitada")
                await browser.close()
                return leads

            # Coleta links de posts
            links = await page.eval_on_selector_all(
                'a[href*="/p/"]',
                'els => [...new Set(els.map(e => e.href))].filter(h => h.includes("/p/"))'
            )
            print(f"[Instagram] {len(links)} posts encontrados")

            for idx, link in enumerate(links[:max_resultados]):
                try:
                    await page.goto(link, wait_until="domcontentloaded", timeout=15000)
                    await _delay(1.5, 2.5)

                    # Tenta pegar nome do perfil
                    autor = ""
                    for sel in ['a[href*="/"]:has-text("@")', 'header a', 'article header a']:
                        try:
                            el = await page.query_selector(sel)
                            if el:
                                autor = (await el.inner_text()).strip()
                                if "@" in autor or "/" in autor:
                                    break
                        except Exception:
                            pass

                    if autor:
                        leads.append({
                            "empresa":  autor.replace("@", ""),
                            "instagram": "@" + autor.lstrip("@/"),
                            "origem":   "Instagram",
                            "status":   "Novo",
                            "nicho":    hashtag,
                        })
                        if callback:
                            callback(len(leads), max_resultados)

                except Exception as e:
                    print(f"[Instagram] Erro post {idx}: {e}")
                    continue

        except Exception as e:
            print(f"[Instagram] Erro geral: {e}")

        await browser.close()

    print(f"[Instagram] Finalizado: {len(leads)} perfis")
    return leads


async def _aceitar_cookies(page):
    for sel in [
        "#L2AGLb",
        'button[aria-label="Aceitar tudo"]',
        'button[aria-label="Accept all"]',
        'form:nth-child(2) button',
        'button.tHlp8d',
    ]:
        try:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                await _delay(1, 1.5)
                print("[Scraper] Cookie dialog dispensado")
                return
        except Exception:
            pass

    for texto in ["Aceitar tudo", "Accept all", "Concordo", "Rejeitar tudo"]:
        try:
            await page.get_by_text(texto, exact=True).click(timeout=2000)
            await _delay(1, 1.5)
            return
        except Exception:
            pass


async def _scroll_lista(page):
    try:
        await page.evaluate("""() => {
            const feed = document.querySelector('div[role="feed"]');
            if (feed) { feed.scrollBy(0, 600); return; }
            const m = document.querySelector('.m6QErb');
            if (m && m.scrollHeight > m.clientHeight) { m.scrollBy(0, 600); return; }
            window.scrollBy(0, 600);
        }""")
        await _delay(0.8, 1.5)
    except Exception:
        pass


async def _delay(mn, mx):
    await asyncio.sleep(random.uniform(mn, mx))


def rodar_pesquisa(nicho, cidade, raio_km, rating_min, max_resultados, callback=None, enriquecer=False):
    return asyncio.run(
        pesquisar_google_maps(nicho, cidade, raio_km, rating_min, max_resultados, callback, enriquecer)
    )


def rodar_instagram(hashtag, max_resultados=20, callback=None):
    return asyncio.run(
        pesquisar_instagram(hashtag, max_resultados, callback)
    )
