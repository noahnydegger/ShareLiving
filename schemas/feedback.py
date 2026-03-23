from datetime import datetime

from pydantic import BaseModel


class FeedbackCreateIn(BaseModel):
    person_id: int
    area: str
    feedback_type: str
    description: str
    priority: str = "medium"


class FeedbackResolveIn(BaseModel):
    resolved: bool


class FeedbackOut(BaseModel):
    id: int
    house_id: int
    person_id: int
    person_name: str
    area: str
    feedback_type: str
    description: str
    priority: str
    resolved: bool
    created_at: datetime
