# ResearchMind · Multi-Agent AI Research System

A four-agent AI research pipeline with a beautiful web UI inspired by enterprise design systems.

## Agents

| # | Agent | Role |
|---|-------|------|
| 01 | **Search Agent** | Finds recent information via Tavily API |
| 02 | **Reader Agent** | Scrapes & extracts deep content from top URLs |
| 03 | **Writer Chain** | Drafts a structured research report |
| 04 | **Critic Chain** | Reviews and scores the report (X/10) |

## Stack

- **Backend**: Flask (Python) with Server-Sent Events for real-time updates
- **Frontend**: Pure HTML/CSS/JS — no framework required
- **AI**: LangChain + GPT-4o-mini
- **Search**: Tavily API
- **Scraping**: BeautifulSoup

## Setup

### 1. Clone & install

```bash
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your API keys
```

Required keys:
- `OPENAI_API_KEY` — from [platform.openai.com](https://platform.openai.com)
- `TAVILY_API_KEY` — from [tavily.com](https://tavily.com)

### 3. Run

```bash
python app.py
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

## Project Structure

```
ResearchMind/
├── app.py              # Flask backend with SSE streaming
├── agents.py           # Search agent, Reader agent, Writer & Critic chains
├── tools.py            # web_search (Tavily) + scrape_url (BeautifulSoup)
├── pipeline.py         # CLI pipeline runner
├── requirements.txt
├── .env.example
├── templates/
│   └── index.html      # Main UI
└── static/
    ├── style.css        # Cohere-inspired design system
    └── app.js           # SSE client & UI controller
```

## Features

- ⚡ **Real-time pipeline** — watch each agent complete live via SSE
- 📝 **Structured reports** — Introduction, Key Findings, Conclusion, Sources
- 🧐 **Critic scoring** — quality score (X/10) with strengths & improvement areas
- ⬇️ **Download** — export report as `.md` file
- 🎨 **Enterprise UI** — Cohere-inspired design with dark header, clean typography
