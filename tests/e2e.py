"""Manual deployment smoke runner (non-destructive reads and demo logins).

Run explicitly after the first build: uv run python tests/e2e.py --base-url https://HOST
Real on-site acceptance still requires live cameras and known-good evidence pairs.
"""
import argparse
import httpx

def run(base_url):
    checks = []
    with httpx.Client(base_url=base_url, timeout=60, follow_redirects=True) as client:
        for path in ("/health", "/api/healthz", "/api/docs", "/api/tickets", "/api/stats", "/api/public/tickets/ND-1043", "/"):
            response = client.get(path)
            checks.append((path,response.status_code==200))
        for role in ("citizen","contractor","je","commissioner"):
            response = client.post("/api/auth/login", json={"email":f"{role}@nagardrishti.demo","password":"NagarDemo2026!"})
            checks.append((f"login {role}",response.status_code==200 and response.json().get("user",{}).get("role")==role))
            client.post("/api/auth/logout")
    for name, passed in checks:
        print(f"{'PASS' if passed else 'FAIL'} {name}")
    if not all(passed for _,passed in checks):
        raise SystemExit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url",required=True)
    run(parser.parse_args().base_url)
