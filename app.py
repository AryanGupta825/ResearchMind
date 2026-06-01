import json
import time
import threading
import uuid
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from agents import build_search_agent, build_reader_agent, writer_chain, critic_chain

app = Flask(__name__)

# In-memory job store
jobs = {}


def run_pipeline(job_id: str, topic: str):
    job = jobs[job_id]
    job["status"] = "running"
    job["steps"] = {
        "search": "running",
        "reader": "waiting",
        "writer": "waiting",
        "critic": "waiting",
    }
    results = {}

    try:
        # ── Step 1: Search ──────────────────────────────────────────────────
        search_agent = build_search_agent()
        sr = search_agent.invoke({
            "messages": [("user", f"Find recent, reliable and detailed information about: {topic}")]
        })
        results["search"] = sr["messages"][-1].content
        job["results"]["search"] = results["search"]
        job["steps"]["search"] = "done"
        job["steps"]["reader"] = "running"

        # ── Step 2: Reader ──────────────────────────────────────────────────
        reader_agent = build_reader_agent()
        rr = reader_agent.invoke({
            "messages": [("user",
                f"Based on the following search results about '{topic}', "
                f"pick the most relevant URL and scrape it for deeper content.\n\n"
                f"Search Results:\n{results['search'][:800]}"
            )]
        })
        results["reader"] = rr["messages"][-1].content
        job["results"]["reader"] = results["reader"]
        job["steps"]["reader"] = "done"
        job["steps"]["writer"] = "running"

        # ── Step 3: Writer ──────────────────────────────────────────────────
        research_combined = (
            f"SEARCH RESULTS:\n{results['search']}\n\n"
            f"DETAILED SCRAPED CONTENT:\n{results['reader']}"
        )
        results["writer"] = writer_chain.invoke({
            "topic": topic,
            "research": research_combined
        })
        job["results"]["writer"] = results["writer"]
        job["steps"]["writer"] = "done"
        job["steps"]["critic"] = "running"

        # ── Step 4: Critic ──────────────────────────────────────────────────
        results["critic"] = critic_chain.invoke({"report": results["writer"]})
        job["results"]["critic"] = results["critic"]
        job["steps"]["critic"] = "done"

        job["status"] = "done"

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/research", methods=["POST"])
def start_research():
    data = request.get_json()
    topic = (data or {}).get("topic", "").strip()
    if not topic:
        return jsonify({"error": "Topic is required"}), 400

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "id": job_id,
        "topic": topic,
        "status": "starting",
        "steps": {
            "search": "waiting",
            "reader": "waiting",
            "writer": "waiting",
            "critic": "waiting",
        },
        "results": {},
        "error": None,
    }

    thread = threading.Thread(target=run_pipeline, args=(job_id, topic), daemon=True)
    thread.start()

    return jsonify({"job_id": job_id})


@app.route("/api/status/<job_id>")
def job_status(job_id):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)


@app.route("/api/stream/<job_id>")
def stream_status(job_id):
    """SSE endpoint that pushes job updates to the browser."""
    def generate():
        prev = None
        while True:
            job = jobs.get(job_id)
            if not job:
                yield f"data: {json.dumps({'error': 'not found'})}\n\n"
                break
            snapshot = json.dumps({
                "status": job["status"],
                "steps": job["steps"],
                "results": job["results"],
                "error": job["error"],
            })
            if snapshot != prev:
                yield f"data: {snapshot}\n\n"
                prev = snapshot
            if job["status"] in ("done", "error"):
                break
            time.sleep(0.5)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000, threaded=True)
