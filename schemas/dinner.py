from pydantic import BaseModel
from datetime import date
from typing import List

class DinnerUpdateIn(BaseModel):
    days: List[date]
    cook: str