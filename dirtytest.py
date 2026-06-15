from playwright.sync_api import sync_playwright

def scrape_scp_judgments(keyword):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Navigate to the Judgment search page
        page.goto("https://www.supremecourt.gov.pk/judgements-orders/")
        
        # Fill search box and click search
        page.fill('input[name="search_keyword"]', keyword)
        page.keyboard.press("Enter")
        
        # Wait for the results table to load
        page.wait_for_selector("table.judgement-table")
        
        # Extract PDF links and Titles
        judgments = page.query_selector_all("tr")
        data = []
        for j in judgments:
            link = j.query_selector("a[href$='.pdf']")
            if link:
                data.append({
                    "title": j.inner_text().split('\n')[0],
                    "url": link.get_attribute("href")
                })
        
        browser.close()
        return data