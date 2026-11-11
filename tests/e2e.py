"""Manual public-launch smoke runner (reads and rejected demo login checks).

Run explicitly after the first build: uv run python tests/e2e.py --base-url https://HOST
Real on-site acceptance still requires live cameras and known-good evidence pairs.
"""
import argparse
import httpx

def run(base_url):
    checks = []
    with httpx.Client(base_url=base_url, timeout=60, follow_redirects=True) as client:
        for path in ("/health", "/api/healthz", "/api/docs", "/api/tickets", "/api/stats", "/privacy", "/"):
            response = client.get(path)
            checks.append((path,response.status_code==200))
        for role in ("citizen","contractor","je","commissioner"):
            response = client.post("/api/auth/login", json={"email":f"{role}@nagardrishti.demo","password":"NagarDemo2026!"})
            checks.append((f"demo {role} blocked", response.status_code == 401))
        response = client.get("/api/tickets")
        if response.status_code == 200:
            checks.append(("public photos redacted", all(t["before_image_url"] == "" for t in response.json())))
    for name, passed in checks:
        print(f"{'PASS' if passed else 'FAIL'} {name}")
    if not all(passed for _,passed in checks):
        raise SystemExit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url",required=True)
    run(parser.parse_args().base_url)
