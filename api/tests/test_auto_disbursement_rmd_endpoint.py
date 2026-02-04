from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import api.main as main_app
import api.database as database
import api.models as models
import api.auth as auth
import api.schemas as schemas

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


def setup_test_db():
    engine = create_engine("sqlite:///:memory:")
    database.Base.metadata.create_all(bind=engine)
    global TestSession
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    # Create a test user
    user = models.User(email="rmdtest@example.com", hashed_password="x", is_active=True, is_confirmed=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    # Add user settings with birthdate for owner
    settings = models.UserSettings(owner_id=user.id, person1_birthdate="1950-01-01", person2_birthdate="1966-01-01")
    session.add(settings)
    session.commit()
    # Add an asset owned by user
    asset = models.Asset(owner_id=user.id, name="Test IRA", category="IRA", value=262000.0)
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return session, user, asset


def test_rmd_endpoint_returns_schedule():
    session, user, asset = setup_test_db()
    # Override dependencies
    main_app.app.dependency_overrides[database.get_db] = override_get_db
    # Override auth to return our user without JWT
    main_app.app.dependency_overrides[auth.get_current_user] = lambda: schemas.UserOut.model_validate(user)

    client = TestClient(main_app.app)

    # Request a 3-year schedule
    resp = client.get(f"/auto-disbursements/rmd?asset_id={asset.id}&year=2026&years=3")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 3
    # Basic checks on returned structure
    for entry in data:
        assert "year" in entry and "rmd_amount" in entry and "divisor" in entry

