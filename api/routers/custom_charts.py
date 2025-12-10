from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json

from .. import schemas, models
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(
    prefix="/custom_charts",
    tags=["Custom Charts"],
    responses={404: {"description": "Not found"}},
)

@router.post("/", response_model=schemas.CustomChartOut, status_code=status.HTTP_201_CREATED)
def create_custom_chart(
    chart: schemas.CustomChartCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_chart = models.CustomChart(**chart.model_dump(), user_id=current_user.id)
    db.add(db_chart)
    db.commit()
    db.refresh(db_chart)
    return db_chart

@router.get("/", response_model=List[schemas.CustomChartOut])
def read_custom_charts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    charts = db.query(models.CustomChart).filter(models.CustomChart.user_id == current_user.id).all()
    return charts

@router.get("/{chart_id}", response_model=schemas.CustomChartOut)
def read_custom_chart(
    chart_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    chart = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.user_id == current_user.id).first()
    if not chart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    return chart

@router.put("/{chart_id}", response_model=schemas.CustomChartOut)
def update_custom_chart(
    chart_id: int,
    chart_update: schemas.CustomChartUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    chart = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.user_id == current_user.id)
    if not chart.first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    
    chart.update(chart_update.model_dump(exclude_unset=True))
    db.commit()
    return chart.first()

@router.delete("/{chart_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_chart(
    chart_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    chart = db.query(models.CustomChart).filter(models.CustomChart.id == chart_id, models.CustomChart.user_id == current_user.id)
    if not chart.first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom chart not found")
    
    chart.delete(synchronize_session=False)
    db.commit()
    return {"detail": "Custom chart deleted successfully"}
