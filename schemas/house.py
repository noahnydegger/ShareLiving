from pydantic import BaseModel


class HouseCredentialsIn(BaseModel):
    house_name: str
    password: str


class HouseAuthOut(BaseModel):
    token: str
    house_id: int
    house_name: str
