from pydantic import BaseModel
from typing import List


class Points(BaseModel):
    locations: List[List[float]]
