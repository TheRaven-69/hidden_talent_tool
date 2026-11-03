"""Pydantic schemas. Mirror README section 7; tell the team before changing."""
from typing import Literal, Optional

from pydantic import AliasChoices, BaseModel, Field

Weight = Literal["must", "nice"]
Confidence = Literal["explicit", "inferred"]
SkillStatus = Literal["explicit", "inferred", "missing"]


# ---------- Stored documents ----------
class JobSkill(BaseModel):
    concept_id: str
    label: str
    weight: Weight = "must"


class PublicJob(BaseModel):
    id: str
    title: str
    location: str = ""
    ad_text: str
    skills: list[JobSkill] = []
    gate: float = 0.5
    pass_threshold: float = 0.7


class Job(PublicJob):
    assessment_brief: str = Field(default="", max_length=6000)


class CandidateSkill(BaseModel):
    concept_id: str
    label: str
    confidence: Confidence
    evidence: str  # quote from CV; required for explicit AND inferred


class Candidate(BaseModel):
    id: str
    # The mock profiles in Cosmos call this field `background_text`
    cv_text: str = Field("", validation_alias=AliasChoices("cv_text", "background_text"))
    cv_blob_path: Optional[str] = None
    partition_key: Optional[str] = None  # Cosmos partition value; kept so updates hit the same document
    skills: list[CandidateSkill] = []


class SkillBreakdownItem(BaseModel):
    concept_id: str
    label: str = ""
    weight: Weight = "must"
    status: SkillStatus
    evidence: Optional[str] = None


class Application(BaseModel):
    id: str
    job_id: str
    candidate_id: str
    match_score: float = 0.0
    coverage: float = 0.0
    similarity: float = 0.0
    skill_breakdown: list[SkillBreakdownItem] = []
    status: Literal["applied", "assessment_invited", "below_gate", "assessed"] = "applied"


class Question(BaseModel):
    id: str
    type: Literal["hard_skill", "soft_skill", "cv_based", "gap_probe"]
    concept_id: Optional[str] = None
    format: Literal["multiple_choice", "open"]
    text: str
    options: list[str] = []
    correct: Optional[str] = None  # MC key, e.g. "B"
    rubric: Optional[str] = None  # for open questions
    answer: Optional[str] = None
    score: Optional[float] = None
    reasoning: Optional[str] = None


class Assessment(BaseModel):
    id: str
    application_id: str
    questions: list[Question] = []
    total_score: Optional[float] = None
    per_skill: dict[str, float] = {}


# ---------- LLM structured outputs ----------
class ExtractedSkill(BaseModel):
    phrase: str
    confidence: Confidence
    evidence: str = Field(description="Verbatim quote from the text supporting the skill")


class ExtractedSkills(BaseModel):
    skills: list[ExtractedSkill]


class PickedConcept(BaseModel):
    concept_id: str = Field(description="One of the candidate concept ids, or 'none'")


class GeneratedQuestions(BaseModel):
    questions: list[Question]


class GradeResult(BaseModel):
    score: float = Field(ge=0, le=1)
    reasoning: str


# ---------- API payloads ----------
class SuggestSkillsRequest(BaseModel):
    ad_text: str


class SuggestSkillsResponse(BaseModel):
    skills: list[JobSkill]


class ApplyRequest(BaseModel):
    job_id: str
    candidate_id: Optional[str] = None  # mock profile
    cv_text: Optional[str] = None  # or pasted/extracted CV text


class SubmitAnswersRequest(BaseModel):
    answers: dict[str, str]  # question_id -> answer


class RecommendRequest(BaseModel):
    candidate_id: Optional[str] = None
    cv_text: Optional[str] = None


class JobRecommendation(BaseModel):
    job: PublicJob
    match_score: float
    coverage: float
    similarity: float
    skill_breakdown: list[SkillBreakdownItem]
    meets_score_gate: bool


class RecommendationResponse(BaseModel):
    candidate_id: str
    skills: list[CandidateSkill]
    recommendations: list[JobRecommendation]
    evaluated_count: int
