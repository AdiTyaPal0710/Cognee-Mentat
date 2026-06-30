from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import aiofiles
import cognee
from cognee.infrastructure.databases.graph import get_graph_engine
import os

load_dotenv()  
# --- Lifespan (replaces deprecated @app.on_event) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Mentat backend starting")
    try:
        await cognee.prune.prune_system(metadata=True)
        print("Cognee system pruned and ready.")
    except Exception as e:
        print(f"Prune skipped (non-fatal): {e}")
    yield
    print("🧠 Mentat backend shutting down.")


app = FastAPI(title="Mentat Backend", lifespan=lifespan)

# --- CORS: allow React dev server ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request Bodies ---
class QueryRequest(BaseModel):
    query_text: str


class ImproveRequest(BaseModel):
    session_ids: list[str] = ["chat_1"]


class ForgetRequest(BaseModel):
    dataset_name: str


# --- Endpoints ---

@app.post("/ingest")
async def ingest_document(file: UploadFile = File(...)):
    """
    Receives a file upload and commits it to the Cognee knowledge graph.
    Uses dataset_name = filename so individual papers can be forgotten later.
    """
    safe_name = os.path.basename(file.filename or "upload")
    dataset_name = safe_name.replace(".", "_").replace(" ", "_")
    file_path = f"./temp_{safe_name}"

    try:
        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()
            await f.write(content)

        await cognee.remember(file_path, dataset_name=dataset_name)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

    return {"status": "success", "message": f"{safe_name} ingested.", "dataset": dataset_name}


@app.get("/graph")
async def get_visual_graph():
    """
    Returns raw node/edge data from the Cognee graph engine for React Flow to render.
    """
    try:
        graph_engine = await get_graph_engine()
        nodes, edges = await graph_engine.get_graph_data()
        return {"nodes": nodes, "edges": edges}
    except Exception as e:
        return {"nodes": [], "edges": [], "error": str(e)}


@app.post("/query")
async def query_graph(request: QueryRequest):
    """
    Runs a recall() query against the knowledge graph.
    Cognee auto-routes between vector similarity and graph traversal.
    """
    try:
        results = await cognee.recall(request.query_text)
        return {"answer": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@app.post("/improve")
async def improve_memory(request: ImproveRequest):
    """
    Applies feedback from user corrections to strengthen/re-weight graph edges.
    Called when the user clicks "Correct this connection" in the Copilot UI.
    """
    try:
        await cognee.improve(session_ids=request.session_ids)
        return {"status": "success", "message": "Memory improved."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Improve failed: {str(e)}")


@app.delete("/forget")
async def forget_dataset(request: ForgetRequest):
    """
    Surgically prunes a named dataset (e.g., a specific paper version)
    from the graph without destroying the rest of the workspace.
    """
    try:
        await cognee.forget(dataset=request.dataset_name)
        return {"status": "success", "message": f"Dataset '{request.dataset_name}' removed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forget failed: {str(e)}")