# ResearchMind · Multi-Agent AI Research System

> **Live Demo → [https://researchmind-q888.onrender.com](https://researchmind-q888.onrender.com)**

ResearchMind is a multi-agent AI research pipeline that takes any topic as input and automatically searches the web, scrapes deep content, writes a structured report, and critiques it — all in real time through a modern web interface.

---

## What It Does

You type a research topic. Four specialized AI agents then work in sequence:

1. **Search Agent** — queries the web and retrieves the most recent, relevant results on your topic
2. **Reader Agent** — picks the best URL from the search results and scrapes the full page content for deeper context
3. **Writer Chain** — combines everything gathered and writes a detailed, structured research report with Introduction, Key Findings, Conclusion, and Sources
4. **Critic Chain** — independently reviews the report and gives it a quality score out of 10, along with strengths and areas to improve

Every step updates live in the browser as it completes. At the end you get a full report you can read on screen or download as a `.md` file.

---

## Tech Stack

### Backend

| Technology | Role |
|---|---|
| **Python** | Core language |
| **Flask** | Web framework — serves the UI and exposes REST + SSE endpoints |
| **Server-Sent Events (SSE)** | Streams real-time pipeline progress to the browser without polling |
| **Threading** | Runs the 4-agent pipeline in a background thread so the server stays responsive |
| **python-dotenv** | Loads API keys from `.env` file securely |

### AI & Agents

| Technology | Role |
|---|---|
| **LangChain** | Agent orchestration framework — builds and runs the agent pipeline |
| **LangChain-Groq** | LangChain integration for the Groq API |
| **Groq API** | Fast LLM inference — runs `llama-3.3-70b-versatile` |
| **`llama-3.3-70b-versatile`** | The LLM powering all four agents and chains |
| **`create_react_agent`** | LangChain utility that builds ReAct-pattern agents for Search and Reader |
| **LCEL (LangChain Expression Language)** | Pipe syntax (`prompt \| llm \| StrOutputParser()`) used to build Writer and Critic chains |
| **ChatPromptTemplate** | Structures system + human prompts for Writer and Critic |
| **StrOutputParser** | Parses raw LLM output to clean strings |

### Tools (inside agents)

| Tool | Library | Role |
|---|---|---|
| `web_search` | **Tavily API** (`tavily-python`) | Searches the live web and returns titles, URLs, and snippets |
| `scrape_url` | **BeautifulSoup4** + **Requests** | Fetches a URL, strips scripts/styles/nav, returns clean readable text |

### Frontend

| Technology | Role |
|---|---|
| **HTML5** | Semantic page structure |
| **CSS3** | Full custom design system — no CSS framework used |
| **Vanilla JavaScript** | SSE client, DOM updates, Markdown renderer, download handler |
| **Google Fonts** | Playfair Display (display), Space Grotesk (UI), DM Mono (mono labels) |
| **Server-Sent Events API** | Browser-side `EventSource` listens to the Flask SSE stream for live updates |

---

## Agent Architecture

```
User Input (topic)
       │
       ▼
┌─────────────────┐
│  Search Agent   │  ← ReAct agent + web_search tool (Tavily)
│  (LangChain)    │
└────────┬────────┘
         │ search results
         ▼
┌─────────────────┐
│  Reader Agent   │  ← ReAct agent + scrape_url tool (BeautifulSoup)
│  (LangChain)    │
└────────┬────────┘
         │ scraped content
         ▼
┌─────────────────┐
│  Writer Chain   │  ← LCEL: prompt | llm | StrOutputParser
│  (LangChain)    │
└────────┬────────┘
         │ research report
         ▼
┌─────────────────┐
│  Critic Chain   │  ← LCEL: prompt | llm | StrOutputParser
│  (LangChain)    │
└────────┬────────┘
         │ score + feedback
         ▼
    Final Output
```

---

## Project Structure

```
ResearchMind/
├── app.py                  # Flask app — REST API + SSE streaming endpoint
├── agents.py               # All 4 agents: Search, Reader, Writer, Critic
├── tools.py                # web_search (Tavily) + scrape_url (BeautifulSoup)
├── pipeline.py             # CLI runner for the full pipeline
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── render.yaml             # Render.com deployment config
├── templates/
│   └── index.html          # Single-page UI
└── static/
    ├── style.css           # Cohere-inspired design system (pure CSS)
    └── app.js              # SSE client + UI controller (vanilla JS)
```

---

## APIs Used

| API | Purpose | Free Tier |
|---|---|---|
| [Groq](https://console.groq.com) | LLM inference (llama-3.3-70b-versatile) | Yes — generous free tier |
| [Tavily](https://app.tavily.com) | Real-time web search | Yes — 1000 searches/month free |

---

## Live Demo

**[https://researchmind-q888.onrender.com](https://researchmind-q888.onrender.com)**

Try topics like:
- `LLM agents 2025`
- `CRISPR gene editing`
- `Fusion energy progress`
- `Autonomous vehicles 2025`

---

*Built with LangChain · Groq · Tavily · Flask · Deployed on Render*
