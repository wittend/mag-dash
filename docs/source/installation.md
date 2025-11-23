<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Installation

## Prerequisites

- Deno 2.x (https://deno.com)
- A modern browser (Chrome, Edge, Firefox, or Safari)

Optional (for building docs locally):
- Python 3.10+ and `pip`

## Get the code

```
git clone https://github.com/your-org/mag-dash.git
cd mag-dash
```

## Run the development server

```
deno task dev
```

Then open `http://localhost:8000` in your browser.

## Production deployment (simple)

- Run the Deno server on your host:

  ```
  PORT=8000 deno run -A main.ts
  ```

- Optionally place it behind a reverse proxy (nginx, Caddy, Traefik) to terminate TLS and add headers like CSP.

## Building the documentation locally

```
python -m venv .venv
. .venv/bin/activate
pip install -r docs/requirements.txt
sphinx-build -b html docs/source docs/_build/html
```

Open `docs/_build/html/index.html`.
