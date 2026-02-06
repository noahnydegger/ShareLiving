from fastapi import APIRouter, Depends
from auth.users import current_user
from schemas.user import UserRead
from models.user import User

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserRead)
def get_me(user: User = Depends(current_user)):
    return user