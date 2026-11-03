from fastapi import APIRouter, HTTPException
from app.models.schemas import RecommendRequest, RecommendationResponse
from app.services import recommendations, storage

router = APIRouter(tags=["recommendations"])


@router.get("/candidates")
def list_candidates():
    # The demo selector only exposes fictional starter profiles.
    return storage.query("candidates", "SELECT c.id, c.background_text FROM c WHERE c.is_synthetic = true")


@router.post("/recommendations", response_model=RecommendationResponse)
def recommend(req: RecommendRequest):
    try:
        return recommendations.recommend(req.candidate_id, req.cv_text)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
